package com.training.tracking.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthRateLimiterTest {

    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final MutableClock clock = new MutableClock(Instant.parse("2026-01-01T10:00:00Z"));
    private final AuthRateLimiter limiter = new AuthRateLimiter(clock);

    @Test
    void admitsUpToTheLimitThenReportsTimeLeftInTheWindow() {
        for (int i = 0; i < 3; i++) {
            assertTrue(limiter.tryAcquire("login|1.2.3.4", 3, WINDOW).isEmpty());
        }
        clock.advance(Duration.ofMinutes(5));

        Optional<Duration> retryAfter = limiter.tryAcquire("login|1.2.3.4", 3, WINDOW);

        assertEquals(Optional.of(Duration.ofMinutes(10)), retryAfter);
    }

    @Test
    void aNewWindowStartsOnceTheOldOneEnds() {
        for (int i = 0; i < 4; i++) {
            limiter.tryAcquire("login|1.2.3.4", 3, WINDOW);
        }
        clock.advance(WINDOW);

        assertTrue(limiter.tryAcquire("login|1.2.3.4", 3, WINDOW).isEmpty());
    }

    @Test
    void keysAreCountedSeparately() {
        for (int i = 0; i < 3; i++) {
            limiter.tryAcquire("login|1.2.3.4", 3, WINDOW);
        }

        assertTrue(limiter.tryAcquire("login|5.6.7.8", 3, WINDOW).isEmpty());
        assertTrue(limiter.tryAcquire("invitation|1.2.3.4", 3, WINDOW).isEmpty());
        assertTrue(limiter.tryAcquire("login|1.2.3.4", 3, WINDOW).isPresent());
    }

    private static final class MutableClock extends Clock {

        private Instant now;

        MutableClock(Instant start) {
            this.now = start;
        }

        void advance(Duration by) {
            now = now.plus(by);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }
}
