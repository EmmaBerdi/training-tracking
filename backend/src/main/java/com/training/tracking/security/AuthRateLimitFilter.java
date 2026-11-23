package com.training.tracking.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;

/**
 * Throttles the anonymous auth endpoints per client IP, before any password or code is hashed:
 * without it, anyone who finds the hostname could guess passwords and reset codes, or register
 * accounts, as fast as the Pi can run BCrypt. Refresh and logout are not limited, so an ordinary
 * session is never locked out.
 */
public class AuthRateLimitFilter extends OncePerRequestFilter {

    /** Paths mapped to the same limit share one counter, keyed by its name. */
    public record Limit(String name, int maxAttempts, Duration window) {
    }

    private final AuthRateLimiter limiter;
    private final Map<String, Limit> limitsByPath;
    private final String clientIpHeader;

    /**
     * @param clientIpHeader header carrying the real client address, or blank to use the socket's.
     *                       Behind the Cloudflare tunnel every connection comes from cloudflared, so
     *                       there it has to be {@code CF-Connecting-IP}. Only set it where a proxy
     *                       always overwrites the header — otherwise a client picks its own key.
     */
    public AuthRateLimitFilter(AuthRateLimiter limiter, Map<String, Limit> limitsByPath, String clientIpHeader) {
        this.limiter = limiter;
        this.limitsByPath = limitsByPath;
        this.clientIpHeader = clientIpHeader;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        Limit limit = "POST".equals(request.getMethod()) ? limitsByPath.get(request.getServletPath()) : null;
        if (limit != null) {
            Optional<Duration> retryAfter = limiter.tryAcquire(
                    limit.name() + "|" + clientIp(request), limit.maxAttempts(), limit.window());
            if (retryAfter.isPresent()) {
                tooManyRequests(response, retryAfter.get());
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private String clientIp(HttpServletRequest request) {
        if (clientIpHeader != null && !clientIpHeader.isBlank()) {
            String forwarded = request.getHeader(clientIpHeader);
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.trim();
            }
        }
        return request.getRemoteAddr();
    }

    private static void tooManyRequests(HttpServletResponse response, Duration retryAfter) throws IOException {
        long seconds = Math.max(1, (retryAfter.toMillis() + 999) / 1000);
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(seconds));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"error\":\"too many requests\"}");
    }
}
