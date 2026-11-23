package com.training.tracking.dto.admin;

import com.training.tracking.dto.auth.Emails;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InviteUserRequest(
        @Email @NotBlank @Size(max = 255) String email,
        @Size(max = 255) String displayName
) {
    public InviteUserRequest {
        email = Emails.normalize(email);
    }
}
