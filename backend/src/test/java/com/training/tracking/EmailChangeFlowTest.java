package com.training.tracking;

import com.training.tracking.dto.auth.AuthResponse;
import com.training.tracking.dto.auth.ChangeEmailRequest;
import com.training.tracking.dto.auth.ChangeEmailResponse;
import com.training.tracking.dto.auth.ConfirmEmailChangeRequest;
import com.training.tracking.dto.auth.LoginRequest;
import com.training.tracking.dto.auth.RefreshRequest;
import com.training.tracking.repository.EmailChangeRequestRepository;
import com.training.tracking.repository.UserRepository;
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
import org.springframework.security.crypto.password.PasswordEncoder;

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

/** Changing the account's address while logged in, through the real filter chain like AuthFlowTest. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.mail.host=localhost")
class EmailChangeFlowTest {

    private static final Pattern CODE = Pattern.compile("\\b(\\d{6})\\b");

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private EmailChangeRequestRepository requestRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockBean
    private JavaMailSender mailSender;

    @BeforeEach
    void mockSenderBuildsRealMessages() {
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
    }

    // A raw map, not the request record, so the server is the one normalising the new address.
    @Test
    void changeMovesTheAccountTellsTheOldAddressAndKeepsTheSession() throws MessagingException {
        AuthResponse session = createAccount("move-old@example.com", "password");

        ResponseEntity<String> requestRes = post(session, "/api/account/email/request",
                Map.of("newEmail", " Move-New@Example.com", "currentPassword", "password"), String.class);
        assertEquals(HttpStatus.ACCEPTED, requestRes.getStatusCode());
        MimeMessage codeMail = lastMail(1);
        assertEquals("move-new@example.com", recipient(codeMail));
        String code = codeIn(codeMail);

        assertEquals(HttpStatus.BAD_REQUEST, confirm(session, otherCode(code), String.class).getStatusCode());
        ResponseEntity<ChangeEmailResponse> confirmRes = confirm(session, code, ChangeEmailResponse.class);
        assertEquals(HttpStatus.OK, confirmRes.getStatusCode());
        assertEquals("move-new@example.com", confirmRes.getBody().email());

        MimeMessage notice = lastMail(2);
        assertEquals("move-old@example.com", recipient(notice));
        assertTrue(textOf(notice).contains("move-new@example.com"), "notice names the new address");

        // The code is single-use.
        assertEquals(HttpStatus.BAD_REQUEST, confirm(session, code, String.class).getStatusCode());

        assertEquals(HttpStatus.UNAUTHORIZED, login("move-old@example.com", "password").getStatusCode());
        ResponseEntity<String> loginRes = restTemplate.postForEntity("/api/auth/login",
                Map.of("email", "MOVE-NEW@example.com ", "password", "password"), String.class);
        assertEquals(HttpStatus.OK, loginRes.getStatusCode());

        ResponseEntity<AuthResponse> refreshRes = restTemplate.postForEntity(
                "/api/auth/refresh", new RefreshRequest(session.refreshToken()), AuthResponse.class);
        assertEquals(HttpStatus.OK, refreshRes.getStatusCode());
        assertEquals("move-new@example.com", refreshRes.getBody().email());
    }

    @Test
    void requestNeedsTokenAndCurrentPassword() {
        AuthResponse session = createAccount("needs-password@example.com", "password");

        ResponseEntity<String> noAuthRes = restTemplate.postForEntity("/api/account/email/request",
                new ChangeEmailRequest("other@example.com", "password"), String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, noAuthRes.getStatusCode());
        ResponseEntity<String> noAuthConfirmRes = restTemplate.postForEntity("/api/account/email/confirm",
                new ConfirmEmailChangeRequest("123456"), String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, noAuthConfirmRes.getStatusCode());

        assertEquals(HttpStatus.BAD_REQUEST,
                request(session, "needs-password-new@example.com", "wrong-password").getStatusCode());
        verify(mailSender, after(500).never()).send(any(MimeMessage.class));
    }

    @Test
    void addressOfAnyAccountIsRefused() {
        AuthResponse session = createAccount("taken-mine@example.com", "password");
        createAccount("taken-other@example.com", "password");

        assertEquals(HttpStatus.CONFLICT,
                request(session, "Taken-Other@example.com", "password").getStatusCode());
        assertEquals(HttpStatus.CONFLICT, request(session, "taken-mine@example.com", "password").getStatusCode());
        verify(mailSender, after(500).never()).send(any(MimeMessage.class));
    }

    @Test
    void addressTakenBeforeTheConfirmIsRefused() {
        AuthResponse session = createAccount("race-mine@example.com", "password");
        request(session, "race-new@example.com", "password");
        String code = codeIn(lastMail(1));

        createAccount("race-new@example.com", "password");

        assertEquals(HttpStatus.CONFLICT, confirm(session, code, String.class).getStatusCode());
        assertEquals(HttpStatus.OK, login("race-mine@example.com", "password").getStatusCode());
        verify(mailSender, after(500).times(1)).send(any(MimeMessage.class));
    }

    @Test
    void codeLocksAfterTooManyWrongGuesses() {
        AuthResponse session = createAccount("guess-old@example.com", "password");
        request(session, "guess-new@example.com", "password");
        String code = codeIn(lastMail(1));

        for (int i = 0; i < 5; i++) {
            assertEquals(HttpStatus.BAD_REQUEST, confirm(session, otherCode(code), String.class).getStatusCode());
        }
        assertEquals(HttpStatus.BAD_REQUEST, confirm(session, code, String.class).getStatusCode());
        assertEquals(HttpStatus.OK, login("guess-old@example.com", "password").getStatusCode());
    }

    @Test
    void expiredCodeIsRejected() {
        AuthResponse session = createAccount("expired-old@example.com", "password");
        request(session, "expired-new@example.com", "password");
        String code = codeIn(lastMail(1));

        requestRepository.findAll().forEach(request -> {
            request.setExpiresAt(Instant.now().minusSeconds(1));
            requestRepository.save(request);
        });

        assertEquals(HttpStatus.BAD_REQUEST, confirm(session, code, String.class).getStatusCode());
        assertEquals(HttpStatus.OK, login("expired-old@example.com", "password").getStatusCode());
    }

    @Test
    void newerRequestRetiresTheEarlierOne() {
        AuthResponse session = createAccount("newer-old@example.com", "password");
        request(session, "newer-first@example.com", "password");
        String first = codeIn(lastMail(1));
        request(session, "newer-second@example.com", "password");
        String second = codeIn(lastMail(2));

        if (!first.equals(second)) {
            assertEquals(HttpStatus.BAD_REQUEST, confirm(session, first, String.class).getStatusCode());
        }
        ResponseEntity<ChangeEmailResponse> confirmRes = confirm(session, second, ChangeEmailResponse.class);
        assertEquals(HttpStatus.OK, confirmRes.getStatusCode());
        assertEquals("newer-second@example.com", confirmRes.getBody().email());
    }

    @Test
    void requestsAreLimitedPerHour() {
        AuthResponse session = createAccount("limit-old@example.com", "password");

        for (int i = 0; i < 3; i++) {
            assertEquals(HttpStatus.ACCEPTED, request(session, "limit-new@example.com", "password").getStatusCode());
        }
        assertEquals(HttpStatus.TOO_MANY_REQUESTS,
                request(session, "limit-new@example.com", "password").getStatusCode());
        verify(mailSender, after(500).times(3)).send(any(MimeMessage.class));
    }

    private AuthResponse createAccount(String email, String password) {
        TestAccounts.create(userRepository, passwordEncoder, email, password);
        return TestAccounts.login(restTemplate, email, password);
    }

    private ResponseEntity<String> login(String email, String password) {
        return restTemplate.postForEntity("/api/auth/login", new LoginRequest(email, password), String.class);
    }

    private ResponseEntity<String> request(AuthResponse session, String newEmail, String currentPassword) {
        return post(session, "/api/account/email/request",
                Map.of("newEmail", newEmail, "currentPassword", currentPassword), String.class);
    }

    private <T> ResponseEntity<T> confirm(AuthResponse session, String code, Class<T> type) {
        return post(session, "/api/account/email/confirm", new ConfirmEmailChangeRequest(code), type);
    }

    private <T> ResponseEntity<T> post(AuthResponse session, String path, Object body, Class<T> type) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(session.accessToken());
        return restTemplate.postForEntity(path, new HttpEntity<>(body, headers), type);
    }

    /** The newest of the {@code sent} mails so far, waiting for it since they go out on another thread. */
    private MimeMessage lastMail(int sent) {
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, timeout(5000).times(sent)).send(captor.capture());
        return captor.getValue();
    }

    private static String recipient(MimeMessage mail) throws MessagingException {
        return InternetAddress.toString(mail.getRecipients(Message.RecipientType.TO));
    }

    /** The plain-text part. */
    private static String textOf(MimeMessage mail) {
        try {
            return (String) ((MimeMultipart) mail.getContent()).getBodyPart(0).getContent();
        } catch (IOException | MessagingException e) {
            throw new AssertionError(e);
        }
    }

    private static String codeIn(MimeMessage mail) {
        Matcher matcher = CODE.matcher(textOf(mail));
        assertTrue(matcher.find(), "mail carries a six-digit code");
        return matcher.group(1);
    }

    private static String otherCode(String code) {
        return "%06d".formatted((Integer.parseInt(code) + 1) % 1_000_000);
    }
}
