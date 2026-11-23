package com.training.tracking.dto.auth;

/** {@code admin} only decides whether the client shows the admin menu; the server checks it itself. */
public record AuthResponse(
        String accessToken,
        String refreshToken,
        long expiresIn,
        String email,
        String displayName,
        boolean admin
) {
}
