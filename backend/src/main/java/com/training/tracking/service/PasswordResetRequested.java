package com.training.tracking.service;

import java.time.Duration;

/** A reset code was stored for {@code email}; {@link PasswordResetMailer} delivers it once committed. */
public record PasswordResetRequested(String email, String code, Duration validFor) {
}
