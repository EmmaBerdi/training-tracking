package com.training.tracking.service;

import com.training.tracking.domain.Invitation;
import com.training.tracking.domain.User;
import com.training.tracking.dto.auth.AcceptInvitationRequest;
import com.training.tracking.dto.auth.AuthResponse;
import com.training.tracking.dto.auth.InvitationDto;
import com.training.tracking.repository.InvitationRepository;
import com.training.tracking.repository.UserRepository;
import com.training.tracking.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

/**
 * One-time links that let an admin-created account set its first password. A link works once, only
 * for its own account, until it expires or a newer one is issued for the same account.
 */
@Service
public class InvitationService {

    static final Duration INVITATION_TTL = Duration.ofDays(7);

    /** @param mailed false when the admin has to pass {@code link} on by hand */
    record Issued(String link, boolean mailed, Instant expiresAt) {
    }

    private final InvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthService authService;
    private final InvitationMailer mailer;
    private final String publicUrl;
    private final SecureRandom random = new SecureRandom();

    public InvitationService(InvitationRepository invitationRepository,
                             UserRepository userRepository,
                             PasswordEncoder passwordEncoder,
                             JwtService jwtService,
                             AuthService authService,
                             InvitationMailer mailer,
                             @Value("${app.public-url}") String publicUrl) {
        this.invitationRepository = invitationRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authService = authService;
        this.mailer = mailer;
        this.publicUrl = publicUrl.endsWith("/") ? publicUrl.substring(0, publicUrl.length() - 1) : publicUrl;
    }

    /** Issues a fresh link for an invited account, which retires every earlier one, and mails it. */
    Issued issue(User user) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        Instant now = Instant.now();
        Invitation invitation = new Invitation();
        invitation.setUserId(user.getId());
        invitation.setTokenHash(jwtService.hashToken(token));
        invitation.setExpiresAt(now.plus(INVITATION_TTL));
        invitation.setCreatedAt(now);
        invitationRepository.save(invitation);

        String link = publicUrl + "/?invite=" + token;
        return new Issued(link, mailer.send(user.getEmail(), link, INVITATION_TTL), invitation.getExpiresAt());
    }

    @Transactional(readOnly = true)
    public InvitationDto lookup(String token) {
        User user = acceptable(token).user();
        return new InvitationDto(user.getEmail(), user.getDisplayName());
    }

    @Transactional
    public AuthResponse accept(AcceptInvitationRequest request) {
        Acceptable acceptable = acceptable(request.token());
        Instant now = Instant.now();
        acceptable.invitation().setUsedAt(now);
        invitationRepository.save(acceptable.invitation());

        User user = acceptable.user();
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setStatus(User.STATUS_ACTIVE);
        if (StringUtils.hasText(request.displayName())) {
            user.setDisplayName(request.displayName().trim());
        }
        user.setLastLoginAt(now);
        userRepository.save(user);
        return authService.issueTokens(user);
    }

    private record Acceptable(Invitation invitation, User user) {
    }

    /** One answer for every reason a link fails, so it can't be used to probe accounts. */
    private Acceptable acceptable(String token) {
        Invitation invitation = invitationRepository.findByTokenHash(jwtService.hashToken(token))
                .filter(InvitationService::isOpen)
                .orElseThrow(InvitationService::invalidInvitation);
        boolean newest = invitationRepository.findFirstByUserIdOrderByCreatedAtDescIdDesc(invitation.getUserId())
                .map(latest -> latest.getId().equals(invitation.getId()))
                .orElse(false);
        if (!newest) {
            throw invalidInvitation();
        }
        User user = userRepository.findById(invitation.getUserId())
                .filter(u -> User.STATUS_INVITED.equals(u.getStatus()))
                .orElseThrow(InvitationService::invalidInvitation);
        return new Acceptable(invitation, user);
    }

    private static boolean isOpen(Invitation invitation) {
        return invitation.getUsedAt() == null && invitation.getExpiresAt().isAfter(Instant.now());
    }

    private static ResponseStatusException invalidInvitation() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid or expired invitation");
    }
}
