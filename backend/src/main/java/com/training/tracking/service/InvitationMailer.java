package com.training.tracking.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

/**
 * Delivers invitation links. Unlike {@link PasswordResetMailer} it runs on the request thread and
 * reports whether the mail went out: the caller is an admin, who gets the link to pass on by hand
 * when it didn't, and there is no anonymous caller to hide anything from.
 */
@Component
public class InvitationMailer {

    private static final Logger log = LoggerFactory.getLogger(InvitationMailer.class);

    private final Mailer mailer;
    private final boolean logLink;

    public InvitationMailer(Mailer mailer,
                            @Value("${app.invitation.log-link:false}") boolean logLink) {
        this.mailer = mailer;
        this.logLink = logLink;
    }

    /**
     * @return whether the link reached someone: handed to the mail server, or logged for local
     *         development, where the log is where the developer looks for it
     */
    public boolean send(String email, String link, Duration validFor) {
        // Local development only, like app.password-reset.log-code: the link claims the account.
        if (!mailer.isConfigured() && logLink) {
            log.warn("No mail host configured; invitation link for {}: {}", email, link);
            return true;
        }
        return mailer.send(email, new MailContent(
                "Training: Einladung",
                "Du bist eingeladen",
                List.of("Hallo,", "du wurdest zu Training eingeladen. Setz dein Passwort, dann bist du "
                        + "direkt angemeldet."),
                new MailContent.Button("Passwort setzen", link),
                "Gültig für %d Tage, funktioniert genau einmal.".formatted(validFor.toDays()),
                "Du hast keine Einladung erwartet? Dann ignoriere diese E-Mail einfach."));
    }
}
