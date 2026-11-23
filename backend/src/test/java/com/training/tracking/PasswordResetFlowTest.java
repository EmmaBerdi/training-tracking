package com.training.tracking;

import com.training.tracking.dto.auth.AuthResponse;
import com.training.tracking.dto.auth.ChangePasswordRequest;
import com.training.tracking.dto.auth.LoginRequest;
import com.training.tracking.dto.auth.PasswordResetConfirmRequest;
import com.training.tracking.dto.auth.PasswordResetRequest;
import com.training.tracking.dto.auth.RefreshRequest;
import com.training.tracking.dto.auth.RegisterRequest;
import com.training.tracking.repository.PasswordResetTokenRepository;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.javamail.JavaMailSender;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Forgotten-password reset and change-password, through the real filter chain like AuthFlowTest. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.mail.host=localhost")
class PasswordResetFlowTest {

    private static final Pattern CODE = Pattern.compile("\\b(\\d{6})\\b");

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private PasswordResetTokenRepository resetTokenRepository;

    @MockBean
    private JavaMailSender mailSender;

    @BeforeEach
    void mockSenderBuildsRealMessages() {
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
    }

    @Test
    void resetEndsAllSessionsAndOnlyTheNewPasswordWorks() {
        String email = "reset-full@example.com";
        AuthResponse session = register(email, "old-password");

        assertEquals(HttpStatus.ACCEPTED, requestReset(email).getStatusCode());
        String code = lastMailedCode(1);

        assertEquals(HttpStatus.BAD_REQUEST, confirm(email, otherCode(code), "new-password").getStatusCode());
        assertEquals(HttpStatus.NO_CONTENT, confirm(email, code, "new-password").getStatusCode());

        // The code is single-use.
        assertEquals(HttpStatus.BAD_REQUEST, confirm(email, code, "third-password").getStatusCode());

        // Sessions from before the reset can no longer refresh.
        ResponseEntity<String> refreshRes = restTemplate.postForEntity(
                "/api/auth/refresh", new RefreshRequest(session.refreshToken()), String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, refreshRes.getStatusCode());

        assertEquals(HttpStatus.UNAUTHORIZED, login(email, "old-password").getStatusCode());
        assertEquals(HttpStatus.OK, login(email, "new-password").getStatusCode());
    }

    // Raw maps, not the request records, so the server is the one normalising the address.
    @Test
    void resetWorksWhateverTheCasingOfTheAddress() throws MessagingException {
        register("reset-casing@example.com", "old-password");

        ResponseEntity<String> requestRes = restTemplate.postForEntity("/api/auth/password-reset/request",
                Map.of("email", " Reset-Casing@Example.com"), String.class);
        assertEquals(HttpStatus.ACCEPTED, requestRes.getStatusCode());
        String code = lastMailedCode(1);
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        assertEquals("reset-casing@example.com",
                InternetAddress.toString(captor.getValue().getRecipients(Message.RecipientType.TO)));

        ResponseEntity<String> confirmRes = restTemplate.postForEntity("/api/auth/password-reset/confirm",
                Map.of("email", "RESET-CASING@example.com ", "code", code, "newPassword", "new-password"),
                String.class);
        assertEquals(HttpStatus.NO_CONTENT, confirmRes.getStatusCode());
        assertEquals(HttpStatus.OK, login("reset-casing@example.com", "new-password").getStatusCode());
    }

    @Test
    void unknownEmailIsAcceptedButNothingIsSent() {
        assertEquals(HttpStatus.ACCEPTED, requestReset("nobody@example.com").getStatusCode());
        verify(mailSender, after(500).never()).send(any(MimeMessage.class));

        assertEquals(HttpStatus.BAD_REQUEST,
                confirm("nobody@example.com", "123456", "new-password").getStatusCode());
    }

    @Test
    void codeLocksAfterTooManyWrongGuesses() {
        String email = "reset-guess@example.com";
        register(email, "old-password");
        requestReset(email);
        String code = lastMailedCode(1);

        for (int i = 0; i < 5; i++) {
            assertEquals(HttpStatus.BAD_REQUEST, confirm(email, otherCode(code), "new-password").getStatusCode());
        }
        assertEquals(HttpStatus.BAD_REQUEST, confirm(email, code, "new-password").getStatusCode());
        assertEquals(HttpStatus.OK, login(email, "old-password").getStatusCode());
    }

    @Test
    void expiredCodeIsRejected() {
        String email = "reset-expired@example.com";
        register(email, "old-password");
        requestReset(email);
        String code = lastMailedCode(1);

        resetTokenRepository.findAll().forEach(token -> {
            token.setExpiresAt(Instant.now().minusSeconds(1));
            resetTokenRepository.save(token);
        });

        assertEquals(HttpStatus.BAD_REQUEST, confirm(email, code, "new-password").getStatusCode());
    }

    @Test
    void newerCodeRetiresTheEarlierOne() {
        String email = "reset-newer@example.com";
        register(email, "old-password");
        requestReset(email);
        String first = lastMailedCode(1);
        requestReset(email);
        String second = lastMailedCode(2);

        if (!first.equals(second)) {
            assertEquals(HttpStatus.BAD_REQUEST, confirm(email, first, "new-password").getStatusCode());
        }
        assertEquals(HttpStatus.NO_CONTENT, confirm(email, second, "new-password").getStatusCode());
    }

    @Test
    void requestsAreLimitedPerHour() {
        String email = "reset-limit@example.com";
        register(email, "old-password");

        for (int i = 0; i < 4; i++) {
            assertEquals(HttpStatus.ACCEPTED, requestReset(email).getStatusCode());
        }
        verify(mailSender, after(500).times(3)).send(any(MimeMessage.class));
    }

    @Test
    void changePasswordNeedsTokenAndCurrentPassword() {
        String email = "change@example.com";
        AuthResponse session = register(email, "old-password");

        ResponseEntity<String> noAuthRes = restTemplate.postForEntity(
                "/api/account/password", new ChangePasswordRequest("old-password", "new-password"), String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, noAuthRes.getStatusCode());

        assertEquals(HttpStatus.BAD_REQUEST,
                changePassword(session, "wrong-password", "new-password").getStatusCode());
        assertEquals(HttpStatus.NO_CONTENT,
                changePassword(session, "old-password", "new-password").getStatusCode());

        ResponseEntity<String> refreshRes = restTemplate.postForEntity(
                "/api/auth/refresh", new RefreshRequest(session.refreshToken()), String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, refreshRes.getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, login(email, "old-password").getStatusCode());
        assertEquals(HttpStatus.OK, login(email, "new-password").getStatusCode());
    }

    private AuthResponse register(String email, String password) {
        ResponseEntity<AuthResponse> res = restTemplate.postForEntity(
                "/api/auth/register", new RegisterRequest(email, password, null), AuthResponse.class);
        assertEquals(HttpStatus.OK, res.getStatusCode());
        return res.getBody();
    }

    private ResponseEntity<String> login(String email, String password) {
        return restTemplate.postForEntity("/api/auth/login", new LoginRequest(email, password), String.class);
    }

    private ResponseEntity<String> requestReset(String email) {
        return restTemplate.postForEntity(
                "/api/auth/password-reset/request", new PasswordResetRequest(email), String.class);
    }

    private ResponseEntity<String> confirm(String email, String code, String newPassword) {
        return restTemplate.postForEntity("/api/auth/password-reset/confirm",
                new PasswordResetConfirmRequest(email, code, newPassword), String.class);
    }

    private ResponseEntity<String> changePassword(AuthResponse session, String current, String next) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(session.accessToken());
        return restTemplate.postForEntity("/api/account/password",
                new HttpEntity<>(new ChangePasswordRequest(current, next), headers), String.class);
    }

    /**
     * The code in the plain-text part of the newest of the {@code sent} mails so far, waiting for it
     * since reset mails go out on another thread.
     */
    private String lastMailedCode(int sent) {
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, timeout(5000).times(sent)).send(captor.capture());
        String text;
        try {
            text = (String) ((MimeMultipart) captor.getValue().getContent()).getBodyPart(0).getContent();
        } catch (IOException | MessagingException e) {
            throw new AssertionError(e);
        }
        Matcher matcher = CODE.matcher(text);
        assertTrue(matcher.find(), "mail carries a six-digit code");
        return matcher.group(1);
    }

    private static String otherCode(String code) {
        return "%06d".formatted((Integer.parseInt(code) + 1) % 1_000_000);
    }
}
