package com.training.tracking.service;

import com.training.tracking.domain.PasswordResetToken;
import com.training.tracking.domain.RefreshToken;
import com.training.tracking.domain.User;
import com.training.tracking.repository.PasswordResetTokenRepository;
import com.training.tracking.repository.RefreshTokenRepository;
import com.training.tracking.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class TokenCleanupTest {

    @Autowired
    private TokenCleanup tokenCleanup;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordResetTokenRepository resetTokenRepository;

    @Test
    void deletesExpiredRefreshTokensAndKeepsRevokedOnesUntilTheyExpire() {
        User user = user("cleanup-refresh@example.com");
        Instant now = Instant.now();
        Long expiredRevoked = refreshToken(user, now.minus(Duration.ofHours(1)), true);
        Long expiredActive = refreshToken(user, now.minus(Duration.ofHours(1)), false);
        Long revoked = refreshToken(user, now.plus(Duration.ofDays(10)), true);
        Long valid = refreshToken(user, now.plus(Duration.ofDays(10)), false);

        tokenCleanup.purge();

        assertFalse(refreshTokenRepository.existsById(expiredRevoked));
        assertFalse(refreshTokenRepository.existsById(expiredActive));
        assertTrue(refreshTokenRepository.existsById(revoked));
        assertTrue(refreshTokenRepository.existsById(valid));
    }

    @Test
    void deletesOldResetCodesAndKeepsWhatTheHourlyLimitCounts() {
        User user = user("cleanup-reset@example.com");
        Instant now = Instant.now();
        Long old = resetCode(user, now.minus(Duration.ofDays(2)));
        for (int i = 0; i < PasswordService.MAX_REQUESTS_PER_HOUR; i++) {
            resetCode(user, now.minus(Duration.ofMinutes(30)));
        }

        tokenCleanup.purge();

        assertFalse(resetTokenRepository.existsById(old));
        assertEquals(PasswordService.MAX_REQUESTS_PER_HOUR, resetTokenRepository
                .countByUserIdAndCreatedAtAfter(user.getId(), now.minus(Duration.ofHours(1))));
    }

    private User user(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("unused");
        user.setCreatedAt(Instant.now());
        return userRepository.save(user);
    }

    private Long refreshToken(User user, Instant expiresAt, boolean revoked) {
        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash(UUID.randomUUID().toString());
        token.setExpiresAt(expiresAt);
        token.setRevoked(revoked);
        token.setCreatedAt(expiresAt.minus(Duration.ofDays(30)));
        return refreshTokenRepository.save(token).getId();
    }

    private Long resetCode(User user, Instant createdAt) {
        PasswordResetToken token = new PasswordResetToken();
        token.setUserId(user.getId());
        token.setCodeHash("unused");
        token.setExpiresAt(createdAt.plus(PasswordService.CODE_TTL));
        token.setAttempts(0);
        token.setCreatedAt(createdAt);
        return resetTokenRepository.save(token).getId();
    }
}
