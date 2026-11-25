package com.training.tracking;

import com.training.tracking.domain.User;
import com.training.tracking.dto.auth.AuthResponse;
import com.training.tracking.dto.auth.LoginRequest;
import com.training.tracking.dto.auth.RefreshRequest;
import com.training.tracking.repository.UserRepository;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Active accounts for tests, stored directly: the app itself only creates them by invitation. */
final class TestAccounts {

    private TestAccounts() {
    }

    static User create(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       String email, String password) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setCreatedAt(Instant.now());
        return userRepository.save(user);
    }

    static AuthResponse login(TestRestTemplate restTemplate, String email, String password) {
        ResponseEntity<AuthResponse> res = restTemplate.postForEntity("/api/auth/login",
                new LoginRequest(email, password), AuthResponse.class);
        assertEquals(HttpStatus.OK, res.getStatusCode());
        return res.getBody();
    }

    static ResponseEntity<String> refresh(TestRestTemplate restTemplate, AuthResponse session) {
        return restTemplate.postForEntity("/api/auth/refresh",
                new RefreshRequest(session.refreshToken()), String.class);
    }
}
