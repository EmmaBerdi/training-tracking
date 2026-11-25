package com.training.tracking;

import com.training.tracking.dto.auth.LoginRequest;
import com.training.tracking.dto.auth.PasswordResetConfirmRequest;
import com.training.tracking.dto.auth.PasswordResetRequest;
import com.training.tracking.dto.auth.RefreshRequest;
import com.training.tracking.repository.UserRepository;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Each test claims its own client address through the configured header, so the counters of one
 * test never reach into another — and the header handling itself is exercised on the way.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.rate-limit.client-ip-header=CF-Connecting-IP",
        "app.rate-limit.login.max-attempts=3",
        "app.rate-limit.password-reset.max-attempts=2",
})
class AuthRateLimitFlowTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /** HttpClient's default retry strategy honours Retry-After on a 429 and would sleep for an hour. */
    @BeforeEach
    void disableRetries() {
        restTemplate.getRestTemplate().setRequestFactory(new HttpComponentsClientHttpRequestFactory(
                HttpClients.custom().disableAutomaticRetries().build()));
    }

    @Test
    void loginIsThrottledPerClientEvenForTheRightPassword() {
        String email = uniqueEmail();
        TestAccounts.create(userRepository, passwordEncoder, email, "correct-password");

        for (int i = 0; i < 3; i++) {
            assertEquals(HttpStatus.UNAUTHORIZED,
                    post("/api/auth/login", new LoginRequest(email, "wrong-password"), "10.0.0.2"));
        }
        ResponseEntity<String> throttled = exchange(
                "/api/auth/login", new LoginRequest(email, "correct-password"), "10.0.0.2");
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, throttled.getStatusCode());
        assertNotNull(throttled.getHeaders().getFirst(HttpHeaders.RETRY_AFTER));
        assertTrue(throttled.getBody().contains("too many requests"));

        // Another client is not affected.
        assertEquals(HttpStatus.OK,
                post("/api/auth/login", new LoginRequest(email, "correct-password"), "10.0.0.3"));
    }

    @Test
    void requestingAndConfirmingAResetCodeShareOneLimit() {
        String email = uniqueEmail();
        assertEquals(HttpStatus.ACCEPTED,
                post("/api/auth/password-reset/request", new PasswordResetRequest(email), "10.0.2.1"));
        assertEquals(HttpStatus.BAD_REQUEST, post("/api/auth/password-reset/confirm",
                new PasswordResetConfirmRequest(email, "000000", "new-password"), "10.0.2.1"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, post("/api/auth/password-reset/confirm",
                new PasswordResetConfirmRequest(email, "000001", "new-password"), "10.0.2.1"));
    }

    @Test
    void refreshIsNotThrottled() {
        for (int i = 0; i < 5; i++) {
            assertEquals(HttpStatus.UNAUTHORIZED,
                    post("/api/auth/refresh", new RefreshRequest("not-a-token"), "10.0.3.1"));
        }
    }

    private HttpStatus post(String path, Object body, String clientIp) {
        return HttpStatus.valueOf(exchange(path, body, clientIp).getStatusCode().value());
    }

    private ResponseEntity<String> exchange(String path, Object body, String clientIp) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("CF-Connecting-IP", clientIp);
        return restTemplate.postForEntity(path, new HttpEntity<>(body, headers), String.class);
    }

    private static String uniqueEmail() {
        return "limit-" + UUID.randomUUID() + "@example.com";
    }
}
