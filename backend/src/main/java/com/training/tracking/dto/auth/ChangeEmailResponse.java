package com.training.tracking.dto.auth;

/** The account's address after the change, for the client to show instead of the old one. */
public record ChangeEmailResponse(String email) {
}
