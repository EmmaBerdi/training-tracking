package com.training.tracking.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ConfirmEmailChangeRequest(
        @NotBlank @Pattern(regexp = "\\d{6}") String code
) {
}
