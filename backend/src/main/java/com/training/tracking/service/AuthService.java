package com.training.tracking.service;

import com.training.tracking.domain.RefreshToken;
import com.training.tracking.domain.User;
import com.training.tracking.dto.auth.AuthResponse;
import com.training.tracking.dto.auth.LoginRequest;
import com.training.tracking.repository.RefreshTokenRepository;
import com.training.tracking.repository.UserRepository;
import com.training.tracking.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    /** Encoded by the real encoder so it carries the same bcrypt cost as stored hashes. */
    private final String dummyHash;

    public AuthService(UserRepository userRepository,
                        RefreshTokenRepository refreshTokenRepository,
                        PasswordEncoder passwordEncoder,
                        JwtService jwtService) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        // The same answer, after the same single bcrypt check, for an unknown address, an invited
        // account (no hash yet), a deactivated one and a wrong password, so neither the response
        // nor its timing reveals whether or in which state the account exists.
        User user = userRepository.findByNormalizedEmail(request.email()).orElse(null);
        boolean hasPassword = user != null && user.getPasswordHash() != null;
        boolean passwordMatches = passwordEncoder.matches(request.password(),
                hasPassword ? user.getPasswordHash() : dummyHash);
        if (!hasPassword || !passwordMatches || !user.isActive()) {
            throw invalidCredentials();
        }
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        return issueTokens(user);
    }

    @Transactional
    public AuthResponse refresh(String rawRefreshToken) {
        String hash = jwtService.hashToken(rawRefreshToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(AuthService::invalidRefreshToken);
        if (stored.isRevoked() || stored.getExpiresAt().isBefore(Instant.now()) || !stored.getUser().isActive()) {
            throw invalidRefreshToken();
        }
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);
        return issueTokens(stored.getUser());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        String hash = jwtService.hashToken(rawRefreshToken);
        refreshTokenRepository.findByTokenHash(hash).ifPresent(stored -> {
            stored.setRevoked(true);
            refreshTokenRepository.save(stored);
        });
    }

    /**
     * Ends every session of the account, the calling device's included, at its next refresh; an
     * access token already handed out stays valid until it expires (app.jwt.access-token-ttl).
     */
    @Transactional
    public void logoutAll(Long userId) {
        refreshTokenRepository.revokeAllForUser(userId);
    }

    /** Starts a session for an account that has just proven itself (login, refresh, accepted invitation). */
    AuthResponse issueTokens(User user) {
        String accessToken = jwtService.generateAccessToken(user.getId(), user.getEmail());
        String rawRefreshToken = jwtService.generateOpaqueRefreshToken();

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setTokenHash(jwtService.hashToken(rawRefreshToken));
        refreshToken.setExpiresAt(jwtService.refreshTokenExpiry());
        refreshToken.setRevoked(false);
        refreshToken.setCreatedAt(Instant.now());
        refreshTokenRepository.save(refreshToken);

        return new AuthResponse(accessToken, rawRefreshToken, jwtService.getAccessTokenTtlSeconds(),
                user.getEmail(), user.getDisplayName(), user.isAdmin());
    }

    private static ResponseStatusException invalidCredentials() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid email or password");
    }

    private static ResponseStatusException invalidRefreshToken() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid or expired refresh token");
    }
}
