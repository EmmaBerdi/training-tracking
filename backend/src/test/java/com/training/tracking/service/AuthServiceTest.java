package com.training.tracking.service;

import com.training.tracking.domain.User;
import com.training.tracking.dto.auth.AuthResponse;
import com.training.tracking.dto.auth.LoginRequest;
import com.training.tracking.repository.RefreshTokenRepository;
import com.training.tracking.repository.UserRepository;
import com.training.tracking.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Every failed login must cost one bcrypt check, or its timing tells which addresses have accounts. */
class AuthServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final AuthService service;

    AuthServiceTest() {
        when(passwordEncoder.encode(anyString())).thenReturn("dummy-hash");
        service = new AuthService(userRepository, mock(RefreshTokenRepository.class), passwordEncoder,
                mock(JwtService.class));
    }

    @Test
    void unknownAddressStillChecksAPassword() {
        when(userRepository.findByNormalizedEmail("nobody@example.com")).thenReturn(Optional.empty());

        assertRejected(new LoginRequest("nobody@example.com", "secret"));
        verify(passwordEncoder, times(1)).matches("secret", "dummy-hash");
    }

    @Test
    void invitedAccountStillChecksAPassword() {
        User user = user(User.STATUS_INVITED, null);
        when(userRepository.findByNormalizedEmail("user@example.com")).thenReturn(Optional.of(user));

        assertRejected(new LoginRequest("user@example.com", "secret"));
        verify(passwordEncoder, times(1)).matches("secret", "dummy-hash");
    }

    @Test
    void deactivatedAccountIsRejectedEvenWithTheRightPassword() {
        User user = user(User.STATUS_DEACTIVATED, "real-hash");
        when(userRepository.findByNormalizedEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret", "real-hash")).thenReturn(true);

        assertRejected(new LoginRequest("user@example.com", "secret"));
        verify(passwordEncoder, times(1)).matches(anyString(), anyString());
    }

    @Test
    void wrongPasswordIsRejected() {
        User user = user(User.STATUS_ACTIVE, "real-hash");
        when(userRepository.findByNormalizedEmail("user@example.com")).thenReturn(Optional.of(user));

        assertRejected(new LoginRequest("user@example.com", "wrong"));
        verify(passwordEncoder, times(1)).matches("wrong", "real-hash");
    }

    @Test
    void rightPasswordLogsIn() {
        User user = user(User.STATUS_ACTIVE, "real-hash");
        when(userRepository.findByNormalizedEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret", "real-hash")).thenReturn(true);

        AuthResponse response = service.login(new LoginRequest("user@example.com", "secret"));

        assertThat(response.email()).isEqualTo("user@example.com");
        assertThat(user.getLastLoginAt()).isNotNull();
    }

    private void assertRejected(LoginRequest request) {
        assertThatThrownBy(() -> service.login(request))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(e.getReason()).isEqualTo("invalid email or password");
                });
    }

    private static User user(String status, String passwordHash) {
        User user = new User();
        user.setId(1L);
        user.setEmail("user@example.com");
        user.setStatus(status);
        user.setPasswordHash(passwordHash);
        return user;
    }
}
