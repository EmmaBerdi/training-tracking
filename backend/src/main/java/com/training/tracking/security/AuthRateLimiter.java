package com.training.tracking.security;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Counts attempts per key in fixed windows, in memory. The backend runs as a single instance, so a
 * map is enough; a restart forgets every count, which only ever errs towards letting someone in.
 */
@Component
public class AuthRateLimiter {

    /** How often expired windows are dropped, so a key seen once doesn't stay in memory forever. */
    private static final Duration SWEEP_INTERVAL = Duration.ofMinutes(1);

    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private volatile Instant nextSweep;

    public AuthRateLimiter() {
        this(Clock.systemUTC());
    }

    AuthRateLimiter(Clock clock) {
        this.clock = clock;
        this.nextSweep = clock.instant().plus(SWEEP_INTERVAL);
    }

    /**
     * Counts one attempt for {@code key}. Returns empty while the window holds at most
     * {@code maxAttempts}, otherwise how long until it ends. Counting and checking are one atomic
     * step, so a burst of parallel requests can't slip past the limit together.
     */
    public Optional<Duration> tryAcquire(String key, int maxAttempts, Duration window) {
        Instant now = clock.instant();
        sweep(now);
        Window current = windows.compute(key, (k, w) -> w == null || !w.end().isAfter(now)
                ? new Window(now.plus(window), 1)
                : new Window(w.end(), w.count() + 1));
        return current.count() <= maxAttempts
                ? Optional.empty()
                : Optional.of(Duration.between(now, current.end()));
    }

    private void sweep(Instant now) {
        if (now.isBefore(nextSweep)) {
            return;
        }
        nextSweep = now.plus(SWEEP_INTERVAL);
        windows.values().removeIf(w -> !w.end().isAfter(now));
    }

    private record Window(Instant end, int count) {
    }
}
