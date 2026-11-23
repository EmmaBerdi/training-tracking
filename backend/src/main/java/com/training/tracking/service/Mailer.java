package com.training.tracking.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;

/** Sends the app's mails in {@link MailLayout}, as HTML with a plain-text alternative. */
@Component
public class Mailer {

    private static final Logger log = LoggerFactory.getLogger(Mailer.class);
    private static final String UTF_8 = StandardCharsets.UTF_8.name();

    private final ObjectProvider<JavaMailSender> mailSender;
    private final MailLayout layout;
    // Checked here rather than left to Boot: an empty MAIL_HOST still sets spring.mail.host, and Boot
    // then creates a sender that fails on first use.
    private final String host;
    private final String from;
    private final String fromName;

    public Mailer(ObjectProvider<JavaMailSender> mailSender,
                  MailLayout layout,
                  @Value("${spring.mail.host:}") String host,
                  @Value("${app.mail.from:}") String from,
                  @Value("${app.mail.from-name:}") String fromName) {
        this.mailSender = mailSender;
        this.layout = layout;
        this.host = host;
        this.from = from;
        this.fromName = fromName;
    }

    /** Whether there is a mail host to send to; without one {@link #send} delivers nothing. */
    public boolean isConfigured() {
        return StringUtils.hasText(host) && mailSender.getIfAvailable() != null;
    }

    /**
     * Failures are logged, not thrown: callers answer anonymous requests, and an error would tell
     * the caller that the address belongs to an account.
     *
     * @return whether the mail server took the mail; an admin is then told to pass a link on by hand
     */
    public boolean send(String to, MailContent content) {
        if (!isConfigured()) {
            log.warn("No mail host configured; mail \"{}\" to {} was not delivered", content.subject(), to);
            return false;
        }
        JavaMailSender sender = mailSender.getIfAvailable();
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, UTF_8);
            if (StringUtils.hasText(from)) {
                if (StringUtils.hasText(fromName)) {
                    helper.setFrom(from, fromName);
                } else {
                    helper.setFrom(from);
                }
            }
            helper.setTo(to);
            helper.setSubject(content.subject());
            // RFC 3834: tells out-of-office and other auto-responders not to answer.
            message.setHeader("Auto-Submitted", "auto-generated");
            // A bare multipart/alternative rather than MimeMessageHelper's mixed/related nesting:
            // there are no attachments or inline images to hold.
            MimeMultipart alternative = new MimeMultipart("alternative");
            alternative.addBodyPart(part(layout.text(content), "plain"));
            alternative.addBodyPart(part(layout.html(content), "html"));
            message.setContent(alternative);
            sender.send(message);
            return true;
        } catch (MailException | MessagingException | UnsupportedEncodingException e) {
            log.error("Could not send mail \"{}\" to {}", content.subject(), to, e);
            return false;
        }
    }

    private static MimeBodyPart part(String body, String subtype) throws MessagingException {
        MimeBodyPart part = new MimeBodyPart();
        part.setText(body, UTF_8, subtype);
        return part;
    }
}
