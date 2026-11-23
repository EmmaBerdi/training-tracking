package com.training.tracking.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** In the body rather than the URL path, so the token doesn't end up in access logs. */
public record InvitationTokenRequest(@NotBlank @Size(max = 255) String token) {
}
