package com.training.tracking.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;

/**
 * Delivers the code confirming a new address, and the notice to the old one once it is replaced.
 * Like {@link PasswordResetMailer}, both go out after the commit and off the request thread, so a
 * mailed code always works and a slow SMTP server holds no database connection.
 */
@Component
public class EmailChangeMailer {

    private static final Logger log = LoggerFactory.getLogger(EmailChangeMailer.class);

    private final Mailer mailer;
    private final String publicUrl;
    private final boolean logCode;

    public EmailChangeMailer(Mailer mailer,
                             @Value("${app.public-url}") String publicUrl,
                             @Value("${app.email-change.log-code:false}") boolean logCode) {
        this.mailer = mailer;
        this.publicUrl = publicUrl;
        this.logCode = logCode;
    }

    @Async
    @TransactionalEventListener
    public void sendCode(EmailChangeRequested request) {
        String email = request.newEmail();
        // Local development only, like app.password-reset.log-code: the code moves the account.
        if (!mailer.isConfigured() && logCode) {
            log.warn("No mail host configured; email change code for {}: {}", email, request.code());
            return;
        }
        mailer.send(email, new MailContent(
                "Training: E-Mail-Adresse bestätigen",
                "E-Mail-Adresse bestätigen",
                List.of("Hallo,", "dein Code, um diese Adresse für dein Training-Konto zu bestätigen, lautet:"),
                new MailContent.Code(request.code()),
                "Gültig für %d Minuten.".formatted(request.validFor().toMinutes()),
                "Du hast das nicht angefordert? Dann ignoriere diese E-Mail einfach — ohne den Code "
                        + "ändert sich nichts."));
    }

    @Async
    @TransactionalEventListener
    public void sendNotice(EmailChanged change) {
        mailer.send(change.oldEmail(), new MailContent(
                "Training: E-Mail-Adresse geändert",
                "E-Mail-Adresse geändert",
                List.of("Hallo,", "die E-Mail-Adresse deines Training-Kontos wurde auf %s geändert. "
                        .formatted(change.newEmail()) + "Ab jetzt meldest du dich mit dieser Adresse an."),
                new MailContent.Button("Training öffnen", publicUrl),
                "An diese Adresse schicken wir ab jetzt keine E-Mails mehr.",
                "Warst du das nicht? Dann melde dich sofort beim Betreiber von Training — ohne Hilfe "
                        + "kommst du nicht mehr in dein Konto."));
    }
}
