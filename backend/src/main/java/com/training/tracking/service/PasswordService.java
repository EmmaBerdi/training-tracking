package com.training.tracking.service;

import com.training.tracking.domain.PasswordResetToken;
import com.training.tracking.domain.User;
import com.training.tracking.repository.PasswordResetTokenRepository;
import com.training.tracking.repository.RefreshTokenRepository;
import com.training.tracking.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;

/**
 * Forgotten-password reset by mailed code, and changing the password while logged in. Both end
 * every session of the account, so the user logs in again everywhere with the new password.
 */
@Service
public class PasswordService {

    static final Duration CODE_TTL = Duration.ofMinutes(15);
    static final int MAX_ATTEMPTS = 5;
    static final int MAX_REQUESTS_PER_HOUR = 3;

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetMailer mailer;
    private final SecureRandom random = new SecureRandom();

    public PasswordService(UserRepository userRepository,
                           PasswordResetTokenRepository resetTokenRepository,
                           RefreshTokenRepository refreshTokenRepository,
                           PasswordEncoder passwordEncoder,
                           PasswordResetMailer mailer) {
        this.userRepository = userRepository;
        this.resetTokenRepository = resetTokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailer = mailer;
    }

    /**
     * Mails a fresh code if the address belongs to an account. Returns the same way whether it does
     * or not, so the endpoint can't be used to find out which addresses are registered.
     */
    @Transactional
    public void requestReset(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            Instant now = Instant.now();
            long recent = resetTokenRepository.countByUserIdAndCreatedAtAfter(
                    user.getId(), now.minus(Duration.ofHours(1)));
            if (recent >= MAX_REQUESTS_PER_HOUR) {
                return;
            }

            String code = "%06d".formatted(random.nextInt(1_000_000));
            PasswordResetToken token = new PasswordResetToken();
            token.setUserId(user.getId());
            token.setCodeHash(passwordEncoder.encode(code));
            token.setExpiresAt(now.plus(CODE_TTL));
            token.setAttempts(0);
            token.setCreatedAt(now);
            resetTokenRepository.save(token);

            mailer.send(user.getEmail(), code, CODE_TTL);
        });
    }

    /**
     * Not rolled back on rejection: a wrong guess has to stay counted, or the attempt limit would
     * never be reached.
     */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public void confirmReset(String email, String code, String newPassword) {
        User user = userRepository.findByEmail(email).orElseThrow(PasswordService::invalidCode);
        // Only the newest code counts: requesting another one retires every earlier code.
        PasswordResetToken token = resetTokenRepository
                .findFirstByUserIdOrderByCreatedAtDescIdDesc(user.getId())
                .orElseThrow(PasswordService::invalidCode);
        if (token.getUsedAt() != null
                || token.getExpiresAt().isBefore(Instant.now())
                || token.getAttempts() >= MAX_ATTEMPTS) {
            throw invalidCode();
        }
        if (!passwordEncoder.matches(code, token.getCodeHash())) {
            token.setAttempts(token.getAttempts() + 1);
            resetTokenRepository.save(token);
            throw invalidCode();
        }

        token.setUsedAt(Instant.now());
        resetTokenRepository.save(token);
        setPassword(user, newPassword);
    }

    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "current password is wrong");
        }
        setPassword(user, newPassword);
    }

    /**
     * Revoking the refresh tokens ends every session at its next refresh; an access token already
     * handed out stays valid until it expires (app.jwt.access-token-ttl).
     */
    private void setPassword(User user, String newPassword) {
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        refreshTokenRepository.revokeAllForUser(user.getId());
    }

    private static ResponseStatusException invalidCode() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid or expired code");
    }
}
