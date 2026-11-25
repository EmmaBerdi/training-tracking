package com.training.tracking;

import com.training.tracking.domain.User;
import com.training.tracking.dto.StateDto;
import com.training.tracking.dto.auth.AuthResponse;
import com.training.tracking.dto.auth.LoginRequest;
import com.training.tracking.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Runs against a real embedded server (not MockMvc) so that container-level behavior — like
 * Boot's internal forward to /error when a controller throws ResponseStatusException — is
 * actually exercised through the Spring Security filter chain, the same as in production.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthFlowTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void loginAndAccessOwnState() {
        String email = "user1@example.com";
        TestAccounts.create(userRepository, passwordEncoder, email, "correct-password");

        // Wrong password is rejected with a generic message.
        ResponseEntity<String> badLoginRes = restTemplate.postForEntity(
                "/api/auth/login", new LoginRequest(email, "wrong-password"), String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, badLoginRes.getStatusCode());

        // Correct login succeeds.
        ResponseEntity<AuthResponse> loginRes = restTemplate.postForEntity(
                "/api/auth/login", new LoginRequest(email, "correct-password"), AuthResponse.class);
        assertEquals(HttpStatus.OK, loginRes.getStatusCode());
        String accessToken = loginRes.getBody().accessToken();
        assertTrue(!accessToken.isBlank());

        // /api/state requires a token.
        ResponseEntity<String> noAuthRes = restTemplate.getForEntity("/api/state", String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, noAuthRes.getStatusCode());

        // With a valid token, a brand-new user sees an empty plan rather than a null one, so the
        // client never has to tell "no account data" apart from "account with nothing in it".
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        ResponseEntity<StateDto> stateRes = restTemplate.exchange(
                "/api/state", HttpMethod.GET, new HttpEntity<>(headers), StateDto.class);
        assertEquals(HttpStatus.OK, stateRes.getStatusCode());
        assertTrue(stateRes.getBody().plan().days().isEmpty());
        assertTrue(stateRes.getBody().plan().warmup().isEmpty());
        assertTrue(stateRes.getBody().logs().isEmpty());
    }

    // A raw map, not the request record: its constructor normalises the address on this side
    // already, and the point is what the server does with it as a phone sends it.
    @Test
    void emailCasingAndSurroundingWhitespaceDoNotMatter() {
        TestAccounts.create(userRepository, passwordEncoder, "casing@example.com", "correct-password");

        ResponseEntity<String> loginRes = restTemplate.postForEntity("/api/auth/login",
                Map.of("email", "  Casing@EXAMPLE.com ", "password", "correct-password"), String.class);
        assertEquals(HttpStatus.OK, loginRes.getStatusCode());
    }

    @Test
    void accountStoredWithCapitalsBeforeNormalisationCanStillLogIn() {
        User legacy = new User();
        legacy.setEmail("Legacy@Example.com");
        legacy.setPasswordHash(passwordEncoder.encode("correct-password"));
        legacy.setCreatedAt(Instant.now());
        userRepository.save(legacy);

        ResponseEntity<String> loginRes = restTemplate.postForEntity("/api/auth/login",
                Map.of("email", "legacy@example.com", "password", "correct-password"), String.class);
        assertEquals(HttpStatus.OK, loginRes.getStatusCode());
    }

    @Test
    void logoutAllEndsEverySessionOfTheCallerOnly() {
        TestAccounts.create(userRepository, passwordEncoder, "everywhere@example.com", "correct-password");
        TestAccounts.create(userRepository, passwordEncoder, "bystander@example.com", "correct-password");
        AuthResponse phone = TestAccounts.login(restTemplate, "everywhere@example.com", "correct-password");
        AuthResponse laptop = TestAccounts.login(restTemplate, "everywhere@example.com", "correct-password");
        AuthResponse bystander = TestAccounts.login(restTemplate, "bystander@example.com", "correct-password");

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(phone.accessToken());
        ResponseEntity<Void> res = restTemplate.exchange(
                "/api/account/logout-all", HttpMethod.POST, new HttpEntity<>(headers), Void.class);
        assertEquals(HttpStatus.NO_CONTENT, res.getStatusCode());

        assertEquals(HttpStatus.UNAUTHORIZED, TestAccounts.refresh(restTemplate, phone).getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, TestAccounts.refresh(restTemplate, laptop).getStatusCode());
        assertEquals(HttpStatus.OK, TestAccounts.refresh(restTemplate, bystander).getStatusCode());

        // The account itself is fine: logging in again starts a new session.
        TestAccounts.login(restTemplate, "everywhere@example.com", "correct-password");
    }

    @Test
    void logoutAllNeedsAToken() {
        ResponseEntity<String> res = restTemplate.postForEntity("/api/account/logout-all", null, String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
    }

    @Test
    void publicRegistrationIsGone() {
        ResponseEntity<String> res = restTemplate.postForEntity("/api/auth/register",
                Map.of("email", "walk-in@example.com", "password", "correct-password"), String.class);
        assertEquals(HttpStatus.NOT_FOUND, res.getStatusCode());
        assertTrue(userRepository.findByNormalizedEmail("walk-in@example.com").isEmpty());
    }
}
