package com.training.tracking.service;

import java.time.Duration;

/** A code was stored to confirm {@code newEmail}; {@link EmailChangeMailer} delivers it once committed. */
public record EmailChangeRequested(String newEmail, String code, Duration validFor) {
}
