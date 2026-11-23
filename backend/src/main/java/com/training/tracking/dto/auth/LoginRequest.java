package com.training.tracking.dto.auth;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank String email,
        @NotBlank String password
) {
    public LoginRequest {
        email = Emails.normalize(email);
    }
}
