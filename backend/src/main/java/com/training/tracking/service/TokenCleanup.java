package com.training.tracking.service;

import com.training.tracking.repository.PasswordResetTokenRepository;
import com.training.tracking.repository.RefreshTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Deletes tokens nothing will ever accept again, so the tables don't grow forever. Invitations are
 * left alone: the admin list shows each account's newest one, expired or not.
 */
@Component
public class TokenCleanup {

    /**
     * Longer than a code lives and longer than the hour {@link PasswordService} counts requests
     * over, so the per-account limit still sees every recent request.
     */
    static final Duration RESET_CODE_RETENTION = Duration.ofDays(1);

    private static final Logger log = LoggerFactory.getLogger(TokenCleanup.class);

    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository resetTokenRepository;

    public TokenCleanup(RefreshTokenRepository refreshTokenRepository,
                        PasswordResetTokenRepository resetTokenRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.resetTokenRepository = resetTokenRepository;
    }

    /**
     * A revoked refresh token is kept until it expires rather than deleted when revoked: presenting
     * a rotated token again is how a stolen one shows itself, and the reuse detection #14 adds
     * needs the row to recognise it.
     */
    @Scheduled(cron = "${app.token-cleanup.cron}", zone = "${app.token-cleanup.zone}")
    @Transactional
    public void purge() {
        Instant now = Instant.now();
        int refreshTokens = refreshTokenRepository.deleteAllExpiredBefore(now);
        int resetCodes = resetTokenRepository.deleteAllCreatedBefore(now.minus(RESET_CODE_RETENTION));
        if (refreshTokens > 0 || resetCodes > 0) {
            log.info("Token cleanup removed {} refresh tokens, {} reset codes", refreshTokens, resetCodes);
        }
    }
}
