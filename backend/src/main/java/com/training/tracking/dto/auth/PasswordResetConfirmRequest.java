package com.training.tracking.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PasswordResetConfirmRequest(
        @NotBlank String email,
        @NotBlank @Pattern(regexp = "\\d{6}") String code,
        @NotBlank @Size(min = 8, max = 255) String newPassword
) {
}
