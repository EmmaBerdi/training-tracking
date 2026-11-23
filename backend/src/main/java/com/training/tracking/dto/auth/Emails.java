package com.training.tracking.dto.auth;

import java.util.Locale;

/**
 * Canonical form of an email address as typed: iOS capitalises the first letter of an input and
 * autofill can add a trailing space, neither of which should make it a different account.
 */
final class Emails {

    private Emails() {
    }

    /** Null stays null so {@code @NotBlank} still reports a missing address. */
    static String normalize(String email) {
        // ROOT, not the server's default locale: in Turkish "I" would lower-case to a dotless "ı".
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
