package com.training.tracking.dto.admin;

import java.time.Instant;

/**
 * What an admin may see of an account: its metadata, never its plans, logs or images.
 *
 * @param invitationExpiresAt when the newest invitation runs out, for an account still invited;
 *                            otherwise null
 */
public record AdminUserDto(
        Long id,
        String email,
        String displayName,
        String status,
        boolean admin,
        Instant createdAt,
        Instant lastLoginAt,
        Instant invitationExpiresAt
) {
}
