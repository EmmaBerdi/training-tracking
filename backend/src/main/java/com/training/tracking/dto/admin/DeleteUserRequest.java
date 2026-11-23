package com.training.tracking.dto.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * {@code confirmEmail} repeats the account's address, so a request with a mixed-up id can't delete
 * the wrong one. In the body rather than the query string, so the address stays out of access logs.
 */
public record DeleteUserRequest(@NotBlank @Size(max = 255) String confirmEmail) {
}
