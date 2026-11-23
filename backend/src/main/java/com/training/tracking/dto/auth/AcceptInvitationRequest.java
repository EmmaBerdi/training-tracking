package com.training.tracking.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code displayName} replaces the one the admin entered; null keeps it. */
public record AcceptInvitationRequest(
        @NotBlank @Size(max = 255) String token,
        @NotBlank @Size(min = 8, max = 255) String password,
        @Size(max = 255) String displayName
) {
}
