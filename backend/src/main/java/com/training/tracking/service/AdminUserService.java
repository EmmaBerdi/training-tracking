package com.training.tracking.service;

import com.training.tracking.domain.Invitation;
import com.training.tracking.domain.User;
import com.training.tracking.dto.admin.AdminUserDto;
import com.training.tracking.dto.admin.InvitationResponse;
import com.training.tracking.dto.admin.InviteUserRequest;
import com.training.tracking.dto.auth.Emails;
import com.training.tracking.repository.InvitationRepository;
import com.training.tracking.repository.RefreshTokenRepository;
import com.training.tracking.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * Account management for admins. Works on account metadata only: nothing here reads a user's
 * plans, logs or images, and deleting an account removes them without looking at them.
 */
@Service
public class AdminUserService {

    private final UserRepository userRepository;
    private final InvitationRepository invitationRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final InvitationService invitationService;
    private final StateService stateService;
    private final EntityManager entityManager;
    private final TransactionTemplate transactionTemplate;

    public AdminUserService(UserRepository userRepository,
                            InvitationRepository invitationRepository,
                            RefreshTokenRepository refreshTokenRepository,
                            InvitationService invitationService,
                            StateService stateService,
                            EntityManager entityManager,
                            TransactionTemplate transactionTemplate) {
        this.userRepository = userRepository;
        this.invitationRepository = invitationRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.invitationService = invitationService;
        this.stateService = stateService;
        this.entityManager = entityManager;
        this.transactionTemplate = transactionTemplate;
    }

    @Transactional(readOnly = true)
    public List<AdminUserDto> list() {
        List<User> users = userRepository.findAll(Sort.by("createdAt", "id"));
        List<Long> invitedIds = users.stream()
                .filter(user -> User.STATUS_INVITED.equals(user.getStatus()))
                .map(User::getId)
                .toList();
        // Every invitation lives equally long, so the newest one is the one expiring last.
        Map<Long, Instant> invitationExpiry = invitationRepository.findAllByUserIdIn(invitedIds).stream()
                .collect(Collectors.toMap(Invitation::getUserId, Invitation::getExpiresAt,
                        (a, b) -> a.isAfter(b) ? a : b));
        return users.stream().map(user -> toDto(user, invitationExpiry.get(user.getId()))).toList();
    }

    public InvitationResponse invite(InviteUserRequest request) {
        return sendInvitation(() -> {
            if (userRepository.existsByNormalizedEmail(request.email())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "email already registered");
            }
            User user = new User();
            user.setEmail(request.email());
            user.setDisplayName(StringUtils.hasText(request.displayName()) ? request.displayName().trim() : null);
            user.setStatus(User.STATUS_INVITED);
            user.setCreatedAt(Instant.now());
            return userRepository.save(user);
        });
    }

    /** A fresh link for an account still waiting; the earlier ones stop working. */
    public InvitationResponse resendInvitation(Long userId) {
        return sendInvitation(() -> {
            User user = find(userId);
            if (!User.STATUS_INVITED.equals(user.getStatus())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "account is not invited");
            }
            return user;
        });
    }

    /**
     * Ends every session at its next refresh. An access token already handed out stays valid until
     * it expires (app.jwt.access-token-ttl), as after a password change.
     */
    @Transactional
    public AdminUserDto deactivate(Long adminId, Long userId) {
        User user = find(userId);
        rejectSelf(adminId, user);
        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "account is not active");
        }
        user.setStatus(User.STATUS_DEACTIVATED);
        userRepository.save(user);
        refreshTokenRepository.revokeAllForUser(user.getId());
        return toDto(user, null);
    }

    @Transactional
    public AdminUserDto reactivate(Long userId) {
        User user = find(userId);
        if (!User.STATUS_DEACTIVATED.equals(user.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "account is not deactivated");
        }
        user.setStatus(User.STATUS_ACTIVE);
        userRepository.save(user);
        return toDto(user, null);
    }

    /**
     * Removes the account with all its data. {@code confirmEmail} has to repeat the account's address,
     * so a request with a mixed-up id can't delete the wrong one.
     */
    @Transactional
    public void delete(Long adminId, Long userId, String confirmEmail) {
        User user = find(userId);
        rejectSelf(adminId, user);
        if (!Emails.normalize(user.getEmail()).equals(Emails.normalize(confirmEmail))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "confirmation does not match");
        }
        deleteAccountData(user.getId());
        userRepository.delete(user);
    }

    /**
     * Children before parents, explicit rather than left to ON DELETE CASCADE, like StateService's
     * wipe: in Postgres a cascade from "user" can reach session_type before the rows that RESTRICT
     * it, and the H2 test schema has no cascades at all. A new table holding a user's rows has to be
     * added here, or deleting an account that has some fails on the foreign key.
     */
    private void deleteAccountData(Long userId) {
        bulkDelete("DELETE FROM PlannedSession p WHERE p.userId = :userId", userId);
        bulkDelete("DELETE FROM RecurringRuleException e WHERE e.id.ruleId IN "
                + "(SELECT r.id FROM RecurringRule r WHERE r.userId = :userId)", userId);
        bulkDelete("DELETE FROM RecurringRulePlan p WHERE p.id.ruleId IN "
                + "(SELECT r.id FROM RecurringRule r WHERE r.userId = :userId)", userId);
        bulkDelete("DELETE FROM RecurringRule r WHERE r.userId = :userId", userId);
        stateService.wipe(userId);
        bulkDelete("DELETE FROM ExerciseImage i WHERE i.userId = :userId", userId);
        entityManager.createNativeQuery("DELETE FROM interval_timer_step WHERE timer_id IN "
                        + "(SELECT id FROM interval_timer WHERE user_id = :userId)")
                .setParameter("userId", userId)
                .executeUpdate();
        bulkDelete("DELETE FROM IntervalTimer t WHERE t.userId = :userId", userId);
        bulkDelete("DELETE FROM SessionType t WHERE t.userId = :userId", userId);
        bulkDelete("DELETE FROM PasswordResetToken t WHERE t.userId = :userId", userId);
        bulkDelete("DELETE FROM RefreshToken t WHERE t.user.id = :userId", userId);
        invitationRepository.deleteAllByUserId(userId);
    }

    private void bulkDelete(String jpql, Long userId) {
        entityManager.createQuery(jpql).setParameter("userId", userId).executeUpdate();
    }

    /**
     * Stores the account's new invitation in its own transaction and mails it after the commit (see
     * {@link InvitationService#issue}).
     */
    private InvitationResponse sendInvitation(Supplier<User> invitedAccount) {
        record Pending(User user, InvitationService.Issued issued) {
        }
        Pending pending = transactionTemplate.execute(status -> {
            User user = invitedAccount.get();
            return new Pending(user, invitationService.issue(user));
        });
        boolean mailed = invitationService.mail(pending.issued());
        return new InvitationResponse(toDto(pending.user(), pending.issued().expiresAt()),
                mailed ? null : pending.issued().link());
    }

    private User find(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "no such account"));
    }

    /** An admin who locks themself out may be the last one, with nobody left to undo it. */
    private static void rejectSelf(Long adminId, User user) {
        if (user.getId().equals(adminId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "not on your own account");
        }
    }

    private static AdminUserDto toDto(User user, Instant invitationExpiresAt) {
        boolean invited = User.STATUS_INVITED.equals(user.getStatus());
        return new AdminUserDto(user.getId(), user.getEmail(), user.getDisplayName(), user.getStatus(),
                user.isAdmin(), user.getCreatedAt(), user.getLastLoginAt(), invited ? invitationExpiresAt : null);
    }
}
