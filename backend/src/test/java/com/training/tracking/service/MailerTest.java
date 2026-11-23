package com.training.tracking.service;

import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MailerTest {

    private static final MailContent CONTENT = new MailContent(
            "Training: Test", "Überschrift", List.of("Hallo,", "<b>nicht fett</b> & {{code}}"),
            "123456", "Gültig für 15 Minuten.", "Kleingedrucktes");

    private final JavaMailSender sender = mock(JavaMailSender.class);

    @Test
    void sendsHtmlWithPlainTextAlternativeFromTheNamedSender() throws Exception {
        when(sender.createMimeMessage()).thenReturn(new MimeMessage((Session) null));

        mailer("smtp.example.com", "NOREPLY Berdi racing").send("user@example.com", CONTENT);

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender).send(captor.capture());
        MimeMessage message = captor.getValue();
        // What the transport does before sending; it writes the parts' Content-Type headers.
        message.saveChanges();
        InternetAddress from = (InternetAddress) message.getFrom()[0];
        assertEquals("noreply@example.com", from.getAddress());
        assertEquals("NOREPLY Berdi racing", from.getPersonal());
        assertEquals("Training: Test", message.getSubject());
        assertEquals("auto-generated", message.getHeader("Auto-Submitted", null));

        MimeMultipart parts = (MimeMultipart) message.getContent();
        assertTrue(parts.getContentType().startsWith("multipart/alternative"));
        assertEquals(2, parts.getCount());
        assertTrue(parts.getBodyPart(0).isMimeType("text/plain"));
        assertTrue(parts.getBodyPart(1).isMimeType("text/html"));

        String text = (String) parts.getBodyPart(0).getContent();
        assertTrue(text.contains("123456"));
        assertTrue(text.contains("<b>nicht fett</b> & {{code}}"));

        String html = (String) parts.getBodyPart(1).getContent();
        assertTrue(html.contains(">123456</td>"));
        assertTrue(html.contains("&lt;b&gt;nicht fett&lt;/b&gt; &amp; {{code}}"));
        assertFalse(html.contains("<b>"));
        assertTrue(html.contains("Überschrift"));
    }

    @Test
    void withoutANameTheBareAddressIsTheSender() throws Exception {
        when(sender.createMimeMessage()).thenReturn(new MimeMessage((Session) null));

        mailer("smtp.example.com", "").send("user@example.com", CONTENT);

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender).send(captor.capture());
        assertEquals("noreply@example.com", InternetAddress.toString(captor.getValue().getFrom()));
    }

    @Test
    void withoutAHostNothingIsSent() {
        Mailer mailer = mailer("", "");

        assertFalse(mailer.isConfigured());
        mailer.send("user@example.com", CONTENT);
        verify(sender, never()).send(any(MimeMessage.class));
    }

    private Mailer mailer(String host, String fromName) {
        var beans = new StaticListableBeanFactory(Map.of("mailSender", sender));
        return new Mailer(beans.getBeanProvider(JavaMailSender.class), new MailLayout(),
                host, "noreply@example.com", fromName);
    }
}
