package com.training.tracking.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

/**
 * Delivers reset codes. Without a mail host there is nowhere to send them, and the code is dropped
 * unless {@code app.password-reset.log-code} is on — a switch for local development only, since a
 * logged code is a password to whoever can read the logs.
 */
@Component
public class PasswordResetMailer {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetMailer.class);

    private final Mailer mailer;
    private final boolean logCode;

    public PasswordResetMailer(Mailer mailer,
                               @Value("${app.password-reset.log-code:false}") boolean logCode) {
        this.mailer = mailer;
        this.logCode = logCode;
    }

    public void send(String email, String code, Duration validFor) {
        if (!mailer.isConfigured()) {
            if (logCode) {
                log.warn("No mail host configured; password reset code for {}: {}", email, code);
            } else {
                log.warn("No mail host configured; password reset code for {} was not delivered", email);
            }
            return;
        }

        mailer.send(email, new MailContent(
                "Training: Passwort zurücksetzen",
                "Passwort zurücksetzen",
                List.of("Hallo,", "dein Code zum Zurücksetzen des Passworts lautet:"),
                code,
                "Gültig für %d Minuten.".formatted(validFor.toMinutes()),
                "Du hast das nicht angefordert? Dann ignoriere diese E-Mail einfach — dein Passwort "
                        + "bleibt unverändert."));
    }
}
