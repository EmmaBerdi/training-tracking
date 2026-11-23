package com.training.tracking;

import com.training.tracking.domain.User;
import com.training.tracking.dto.auth.AcceptInvitationRequest;
import com.training.tracking.dto.auth.AuthResponse;
import com.training.tracking.repository.UserRepository;
import jakarta.mail.Message;
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
import org.springframework.mail.javamail.JavaMailSender;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
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
    private JavaMailSender mailSender;

    @Test
    void aConfiguredAddressWithoutAccountIsInvitedAsAdmin() throws Exception {
        User admin = userRepository.findByNormalizedEmail("first.admin@example.com").orElseThrow();
        assertThat(admin.isAdmin()).isTrue();
        assertThat(admin.getStatus()).isEqualTo(User.STATUS_INVITED);

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        MimeMessage mail = captor.getValue();
        assertThat(InternetAddress.toString(mail.getRecipients(Message.RecipientType.TO)))
                .isEqualTo("first.admin@example.com");
        MimeMultipart parts = (MimeMultipart) mail.getContent();
        String html = (String) parts.getBodyPart(1).getContent();
        assertThat(html).contains(">Passwort setzen</a>");
        Matcher matcher = Pattern.compile("invite=([A-Za-z0-9_-]+)").matcher((String) parts.getBodyPart(0).getContent());
        assertThat(matcher.find()).isTrue();

        ResponseEntity<AuthResponse> accepted = restTemplate.postForEntity("/api/auth/invitation/accept",
                new AcceptInvitationRequest(matcher.group(1), "chosen-password", null), AuthResponse.class);
        assertThat(accepted.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(accepted.getBody().admin()).isTrue();
    }
}
