package com.training.tracking.service;

/** An account moved from {@code oldEmail} to {@code newEmail}; {@link EmailChangeMailer} tells the old address. */
public record EmailChanged(String oldEmail, String newEmail) {
}
