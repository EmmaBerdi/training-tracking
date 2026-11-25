package com.training.tracking.service;

import com.training.tracking.domain.EmailChangeRequest;
import com.training.tracking.domain.User;
import com.training.tracking.dto.auth.ChangeEmailResponse;
import com.training.tracking.repository.EmailChangeRequestRepository;
import com.training.tracking.repository.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;

/**
 * Moves a logged-in account to a new email address once a code mailed there proves the user reads
 * it. Codes follow the password reset's rules ({@link PasswordService}): hashed, short-lived, only
 * the newest counts, locked after too many wrong guesses. The session stays open; the old address
 * is told afterwards, so a change made from a hijacked session doesn't go unnoticed.
 */
@Service
public class EmailChangeService {

    private final UserRepository userRepository;
    private final EmailChangeRequestRepository requestRepository;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationEventPublisher events;
    private final SecureRandom random = new SecureRandom();

    public EmailChangeService(UserRepository userRepository,
                              EmailChangeRequestRepository requestRepository,
                              PasswordEncoder passwordEncoder,
                              ApplicationEventPublisher events) {
        this.userRepository = userRepository;
        this.requestRepository = requestRepository;
        this.passwordEncoder = passwordEncoder;
        this.events = events;
    }

    /**
     * Unlike the anonymous reset request, this one may say why it fails: only the account's own,
     * logged-in user gets the answer, and a taken address is no secret to anyone holding a session.
     */
    @Transactional
    public void requestChange(Long userId, String newEmail, String currentPassword) {
        User user = activeUser(userId);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "current password is wrong");
        }
        if (userRepository.existsByNormalizedEmail(newEmail)) {
            throw emailTaken();
        }
        Instant now = Instant.now();
        long recent = requestRepository.countByUserIdAndCreatedAtAfter(user.getId(), now.minus(Duration.ofHours(1)));
        if (recent >= PasswordService.MAX_REQUESTS_PER_HOUR) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too many email change requests");
        }

        String code = "%06d".formatted(random.nextInt(1_000_000));
        EmailChangeRequest request = new EmailChangeRequest();
        request.setUserId(user.getId());
        request.setNewEmail(newEmail);
        request.setCodeHash(passwordEncoder.encode(code));
        request.setExpiresAt(now.plus(PasswordService.CODE_TTL));
        request.setAttempts(0);
        request.setCreatedAt(now);
        requestRepository.save(request);

        events.publishEvent(new EmailChangeRequested(newEmail, code, PasswordService.CODE_TTL));
    }

    /**
     * Not rolled back on rejection: a wrong guess has to stay counted, or the attempt limit would
     * never be reached.
     */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public ChangeEmailResponse confirmChange(Long userId, String code) {
        User user = activeUser(userId);
        // Only the newest request counts: asking again retires every earlier code.
        EmailChangeRequest request = requestRepository.findFirstByUserIdOrderByCreatedAtDescIdDesc(user.getId())
                .orElseThrow(EmailChangeService::invalidCode);
        if (request.getUsedAt() != null
                || request.getExpiresAt().isBefore(Instant.now())
                || request.getAttempts() >= PasswordService.MAX_ATTEMPTS) {
            throw invalidCode();
        }
        if (!passwordEncoder.matches(code, request.getCodeHash())) {
            request.setAttempts(request.getAttempts() + 1);
            requestRepository.save(request);
            throw invalidCode();
        }
        // Checked again: someone may have been given the address since the code was mailed.
        if (userRepository.existsByNormalizedEmail(request.getNewEmail())) {
            throw emailTaken();
        }

        request.setUsedAt(Instant.now());
        requestRepository.save(request);
        String oldEmail = user.getEmail();
        user.setEmail(request.getNewEmail());
        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Taken between the check above and the flush. The failed flush leaves nothing worth
            // committing, and noRollbackFor would otherwise commit it.
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            throw emailTaken();
        }

        events.publishEvent(new EmailChanged(oldEmail, user.getEmail()));
        return new ChangeEmailResponse(user.getEmail());
    }

    /** A deactivated account's access token outlives the deactivation by up to its TTL. */
    private User activeUser(Long userId) {
        return userRepository.findById(userId).filter(User::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    private static ResponseStatusException emailTaken() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "email already registered");
    }

    private static ResponseStatusException invalidCode() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid or expired code");
    }
}
