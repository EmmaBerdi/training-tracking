package com.training.tracking;

import com.training.tracking.domain.User;
import com.training.tracking.dto.auth.AcceptInvitationRequest;
import com.training.tracking.dto.auth.AuthResponse;
import com.training.tracking.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

/** The first admin, named in config before any account exists. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.mail.host=localhost",
        "app.admin.emails= First.Admin@Example.com ,",
})
class AdminBootstrapTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @MockBean
    private JavaMailSender mailSender;

    @Test
    void aConfiguredAddressWithoutAccountIsInvitedAsAdmin() {
        User admin = userRepository.findByNormalizedEmail("first.admin@example.com").orElseThrow();
        assertThat(admin.isAdmin()).isTrue();
        assertThat(admin.getStatus()).isEqualTo(User.STATUS_INVITED);

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(captor.capture());
        assertThat(captor.getValue().getTo()).containsExactly("first.admin@example.com");
        Matcher matcher = Pattern.compile("invite=([A-Za-z0-9_-]+)").matcher(captor.getValue().getText());
        assertThat(matcher.find()).isTrue();

        ResponseEntity<AuthResponse> accepted = restTemplate.postForEntity("/api/auth/invitation/accept",
                new AcceptInvitationRequest(matcher.group(1), "chosen-password", null), AuthResponse.class);
        assertThat(accepted.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(accepted.getBody().admin()).isTrue();
    }
}
