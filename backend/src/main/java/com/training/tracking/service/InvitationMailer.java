package com.training.tracking.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Duration;

/**
 * Delivers invitation links. Unlike {@link PasswordResetMailer} it reports whether the mail went
 * out: the caller is an admin, who gets the link to pass on by hand when it didn't.
 */
@Component
public class InvitationMailer {

    private static final Logger log = LoggerFactory.getLogger(InvitationMailer.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    // See PasswordResetMailer: an empty MAIL_HOST still sets spring.mail.host.
    private final String host;
    private final String from;
    private final boolean logLink;

    public InvitationMailer(ObjectProvider<JavaMailSender> mailSender,
                            @Value("${spring.mail.host:}") String host,
                            @Value("${app.mail.from:}") String from,
                            @Value("${app.invitation.log-link:false}") boolean logLink) {
        this.mailSender = mailSender;
        this.host = host;
        this.from = from;
        this.logLink = logLink;
    }

    /** @return whether the mail was handed to the mail server */
    public boolean send(String email, String link, Duration validFor) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (!StringUtils.hasText(host) || sender == null) {
            // Local development only, like app.password-reset.log-code: the link claims the account.
            if (logLink) {
                log.warn("No mail host configured; invitation link for {}: {}", email, link);
            } else {
                log.warn("No mail host configured; invitation for {} was not mailed", email);
            }
            return false;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        if (StringUtils.hasText(from)) {
            message.setFrom(from);
        }
        message.setTo(email);
        message.setSubject("Training: Einladung");
        message.setText("""
                Hallo,

                du wurdest zu Training eingeladen. Über diesen Link setzt du dein Passwort und \
                meldest dich an:

                %s

                Der Link ist %d Tage gültig und funktioniert genau einmal. Wenn du keine Einladung \
                erwartet hast, ignoriere diese E-Mail einfach.
                """.formatted(link, validFor.toDays()));
        try {
            sender.send(message);
            return true;
        } catch (MailException e) {
            log.error("Could not send invitation mail to {}", email, e);
            return false;
        }
    }
}
