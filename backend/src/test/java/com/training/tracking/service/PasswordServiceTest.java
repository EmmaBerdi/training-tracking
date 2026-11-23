package com.training.tracking.service;

import com.training.tracking.domain.User;
import com.training.tracking.repository.PasswordResetTokenRepository;
import com.training.tracking.repository.RefreshTokenRepository;
import com.training.tracking.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The reset request must cost the same for every address, or its timing tells which are registered. */
class PasswordServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final PasswordResetTokenRepository resetTokenRepository = mock(PasswordResetTokenRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final PasswordService service = new PasswordService(userRepository, resetTokenRepository,
            mock(RefreshTokenRepository.class), passwordEncoder, events);

    @Test
    void unknownAddressStillHashesACode() {
        when(userRepository.findByNormalizedEmail("nobody@example.com")).thenReturn(Optional.empty());

        service.requestReset("nobody@example.com");

        verify(passwordEncoder, times(1)).encode(anyString());
        verify(events, never()).publishEvent(any());
    }

    @Test
    void rateLimitedAddressStillHashesACode() {
        when(userRepository.findByNormalizedEmail("user@example.com")).thenReturn(Optional.of(user()));
        when(resetTokenRepository.countByUserIdAndCreatedAtAfter(eq(1L), any()))
                .thenReturn((long) PasswordService.MAX_REQUESTS_PER_HOUR);

        service.requestReset("user@example.com");

        verify(passwordEncoder, times(1)).encode(anyString());
        verify(events, never()).publishEvent(any());
    }

    @Test
    void knownAddressHashesOnceAndPublishesTheMail() {
        when(userRepository.findByNormalizedEmail("user@example.com")).thenReturn(Optional.of(user()));

        service.requestReset("user@example.com");

        verify(passwordEncoder, times(1)).encode(anyString());
        verify(events).publishEvent(any(PasswordResetRequested.class));
    }

    private static User user() {
        User user = new User();
        user.setId(1L);
        user.setEmail("user@example.com");
        return user;
    }
}
