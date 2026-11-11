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
 * Delivers reset codes. Without a mail host there is nowhere to send them, and the code is dropped
 * unless {@code app.password-reset.log-code} is on — a switch for local development only, since a
 * logged code is a password to whoever can read the logs.
 */
@Component
public class PasswordResetMailer {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetMailer.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    // Checked here rather than left to Boot: an empty MAIL_HOST still sets spring.mail.host, and Boot
    // then creates a sender that fails on first use.
    private final String host;
    private final String from;
    private final boolean logCode;

    public PasswordResetMailer(ObjectProvider<JavaMailSender> mailSender,
                               @Value("${spring.mail.host:}") String host,
                               @Value("${app.mail.from:}") String from,
                               @Value("${app.password-reset.log-code:false}") boolean logCode) {
        this.mailSender = mailSender;
        this.host = host;
        this.from = from;
        this.logCode = logCode;
    }

    public void send(String email, String code, Duration validFor) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (!StringUtils.hasText(host) || sender == null) {
            if (logCode) {
                log.warn("No mail host configured; password reset code for {}: {}", email, code);
            } else {
                log.warn("No mail host configured; password reset code for {} was not delivered", email);
            }
            return;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        if (StringUtils.hasText(from)) {
            message.setFrom(from);
        }
        message.setTo(email);
        message.setSubject("Training: Passwort zurücksetzen");
        message.setText("""
                Hallo,

                dein Code zum Zurücksetzen des Passworts lautet:

                %s

                Er ist %d Minuten gültig. Wenn du das nicht angefordert hast, ignoriere diese E-Mail \
                einfach — dein Passwort bleibt dann unverändert.
                """.formatted(code, validFor.toMinutes()));
        try {
            sender.send(message);
        } catch (MailException e) {
            // Swallowed so the caller still answers 202: an error here would tell an anonymous
            // caller that the address belongs to an account.
            log.error("Could not send password reset mail to {}", email, e);
        }
    }
}
