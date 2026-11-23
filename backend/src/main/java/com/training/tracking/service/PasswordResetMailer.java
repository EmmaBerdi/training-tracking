package com.training.tracking.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;

/**
 * Delivers reset codes. Without a mail host there is nowhere to send them, and the code is dropped
 * unless {@code app.password-reset.log-code} is on — a switch for local development only, since a
 * logged code is a password to whoever can read the logs.
 *
 * <p>Runs after the code is committed and off the request thread, so the request answers as fast
 * for a known address as for an unknown one, and a slow SMTP server holds no database connection.
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

    @Async
    @TransactionalEventListener
    public void send(PasswordResetRequested request) {
        String email = request.email();
        if (!mailer.isConfigured()) {
            if (logCode) {
                log.warn("No mail host configured; password reset code for {}: {}", email, request.code());
            } else {
                log.warn("No mail host configured; password reset code for {} was not delivered", email);
            }
            return;
        }

        mailer.send(email, new MailContent(
                "Training: Passwort zurücksetzen",
                "Passwort zurücksetzen",
                List.of("Hallo,", "dein Code zum Zurücksetzen des Passworts lautet:"),
                request.code(),
                "Gültig für %d Minuten.".formatted(request.validFor().toMinutes()),
                "Du hast das nicht angefordert? Dann ignoriere diese E-Mail einfach — dein Passwort "
                        + "bleibt unverändert."));
    }
}
