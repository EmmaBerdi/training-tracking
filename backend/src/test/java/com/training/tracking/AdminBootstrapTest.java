package com.training.tracking;

import com.training.tracking.domain.Invitation;
import com.training.tracking.domain.User;
import com.training.tracking.dto.auth.AcceptInvitationRequest;
import com.training.tracking.dto.auth.AuthResponse;
import com.training.tracking.repository.InvitationRepository;
import com.training.tracking.repository.UserRepository;
import com.training.tracking.service.AdminBootstrap;
import com.training.tracking.service.InvitationService;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The first admin, named in config before any account exists. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.mail.host=localhost",
        "app.admin.emails= First.Admin@Example.com ,",
})
class AdminBootstrapTest {

    /**
     * A plain mock rather than {@code @MockBean}: the invitation goes out while the context starts,
     * and the mock has to build real messages by then. {@code @MockBean} would also reset it before
     * the test could look at what was sent.
     */
    @TestConfiguration
    static class MailConfig {
        @Bean
        @Primary
        JavaMailSender mailSender() {
            JavaMailSender sender = mock(JavaMailSender.class);
            when(sender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
            return sender;
        }
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private InvitationRepository invitationRepository;

    @Autowired
    private InvitationService invitationService;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private JavaMailSender mailSender;

    @Test
    void aConfiguredAddressWithoutAccountIsInvitedAsAdmin() throws Exception {
        User admin = userRepository.findByNormalizedEmail("first.admin@example.com").orElseThrow();
        assertThat(admin.isAdmin()).isTrue();
        assertThat(admin.getStatus()).isEqualTo(User.STATUS_INVITED);

        List<MimeMessage> mails = mailsTo("first.admin@example.com");
        assertThat(mails).hasSize(1);
        MimeMultipart parts = (MimeMultipart) mails.get(0).getContent();
        String html = (String) parts.getBodyPart(1).getContent();
        assertThat(html).contains(">Passwort setzen</a>");
        Matcher matcher = Pattern.compile("#invite=([A-Za-z0-9_-]+)").matcher((String) parts.getBodyPart(0).getContent());
        assertThat(matcher.find()).isTrue();

        ResponseEntity<AuthResponse> accepted = restTemplate.postForEntity("/api/auth/invitation/accept",
                new AcceptInvitationRequest(matcher.group(1), "chosen-password", null), AuthResponse.class);
        assertThat(accepted.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(accepted.getBody().admin()).isTrue();
    }

    @Test
    void aRestartKeepsAnOpenLinkAndReplacesOneThatWasNotMailed() {
        String email = "restarted.admin@example.com";
        AdminBootstrap bootstrap = new AdminBootstrap(userRepository, invitationService, transactionTemplate, email);

        bootstrap.run(null);
        Long id = userRepository.findByNormalizedEmail(email).orElseThrow().getId();
        assertThat(mailsTo(email)).hasSize(1);

        // The link in the inbox still works, so a restart must not retire it.
        bootstrap.run(null);
        assertThat(mailsTo(email)).hasSize(1);
        assertThat(invitationsOf(id)).hasSize(1);

        // Once it has expired, a restart sends a new one; when that can't be mailed it is withdrawn...
        Invitation first = invitationsOf(id).get(0);
        first.setExpiresAt(Instant.now().minusSeconds(1));
        invitationRepository.save(first);
        doThrow(new MailSendException("down")).when(mailSender).send(any(MimeMessage.class));
        try {
            bootstrap.run(null);
        } finally {
            doNothing().when(mailSender).send(any(MimeMessage.class));
        }
        assertThat(invitationsOf(id)).hasSize(1);

        // ...so the next start, finding no open link, tries again.
        bootstrap.run(null);
        assertThat(mailsTo(email)).hasSize(3);
        assertThat(invitationsOf(id)).hasSize(2);
    }

    private List<Invitation> invitationsOf(Long userId) {
        return invitationRepository.findAllByUserIdIn(List.of(userId));
    }

    /** Every mail handed to the sender for this address, the failed attempts included. */
    private List<MimeMessage> mailsTo(String email) {
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, atLeastOnce()).send(captor.capture());
        return captor.getAllValues().stream().filter(mail -> {
            try {
                return email.equals(InternetAddress.toString(mail.getRecipients(Message.RecipientType.TO)));
            } catch (MessagingException e) {
                throw new AssertionError(e);
            }
        }).toList();
    }
}
