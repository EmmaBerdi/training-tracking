package com.training.tracking;

import com.training.tracking.dto.auth.AuthResponse;
import com.training.tracking.dto.auth.ChangePasswordRequest;
import com.training.tracking.dto.auth.LoginRequest;
import com.training.tracking.dto.auth.PasswordResetConfirmRequest;
import com.training.tracking.dto.auth.PasswordResetRequest;
import com.training.tracking.dto.auth.RefreshRequest;
import com.training.tracking.dto.auth.RegisterRequest;
import com.training.tracking.repository.PasswordResetTokenRepository;
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
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.time.Instant;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

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

    @Test
    void unknownEmailIsAcceptedButNothingIsSent() {
        assertEquals(HttpStatus.ACCEPTED, requestReset("nobody@example.com").getStatusCode());
        verify(mailSender, never()).send(any(SimpleMailMessage.class));

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
        verify(mailSender, times(3)).send(any(SimpleMailMessage.class));
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

    /** The code in the newest of the {@code sent} mails so far. */
    private String lastMailedCode(int sent) {
        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender, times(sent)).send(captor.capture());
        Matcher matcher = CODE.matcher(captor.getValue().getText());
        assertTrue(matcher.find(), "mail carries a six-digit code");
        return matcher.group(1);
    }

    private static String otherCode(String code) {
        return "%06d".formatted((Integer.parseInt(code) + 1) % 1_000_000);
    }
}
