package com.training.tracking.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangeEmailRequest(
        @Email @NotBlank @Size(max = 255) String newEmail,
        @NotBlank String currentPassword
) {
    public ChangeEmailRequest {
        newEmail = Emails.normalize(newEmail);
    }
}
