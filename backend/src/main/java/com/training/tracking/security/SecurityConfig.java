package com.training.tracking.security;

import com.training.tracking.security.AuthRateLimitFilter.Limit;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${app.cors.allowed-origins}")
    private String[] allowedOrigins;

    @Value("${app.rate-limit.client-ip-header:}")
    private String clientIpHeader;

    @Value("${app.rate-limit.login.max-attempts}")
    private int loginMaxAttempts;

    @Value("${app.rate-limit.login.window}")
    private Duration loginWindow;

    @Value("${app.rate-limit.register.max-attempts}")
    private int registerMaxAttempts;

    @Value("${app.rate-limit.register.window}")
    private Duration registerWindow;

    @Value("${app.rate-limit.password-reset.max-attempts}")
    private int passwordResetMaxAttempts;

    @Value("${app.rate-limit.password-reset.window}")
    private Duration passwordResetWindow;

    @Value("${app.rate-limit.invitation.max-attempts}")
    private int invitationMaxAttempts;

    @Value("${app.rate-limit.invitation.window}")
    private Duration invitationWindow;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   JwtService jwtService,
                                                   AuthRateLimiter rateLimiter,
                                                   AdminAccess adminAccess) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**", "/error").permitAll()
                        .requestMatchers("/api/admin/**").access(adminAccess)
                        .anyRequest().authenticated())
                .exceptionHandling(handling -> handling.authenticationEntryPoint(this::unauthorized))
                .addFilterBefore(authRateLimitFilter(rateLimiter), UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(new JwtAuthenticationFilter(jwtService), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /**
     * Both reset steps share one limit, so asking for fresh codes doesn't buy more guesses; the two
     * invitation steps likewise.
     */
    private AuthRateLimitFilter authRateLimitFilter(AuthRateLimiter rateLimiter) {
        Limit passwordReset = new Limit("password-reset", passwordResetMaxAttempts, passwordResetWindow);
        Limit invitation = new Limit("invitation", invitationMaxAttempts, invitationWindow);
        Map<String, Limit> limitsByPath = Map.of(
                "/api/auth/login", new Limit("login", loginMaxAttempts, loginWindow),
                "/api/auth/register", new Limit("register", registerMaxAttempts, registerWindow),
                "/api/auth/password-reset/request", passwordReset,
                "/api/auth/password-reset/confirm", passwordReset,
                "/api/auth/invitation/lookup", invitation,
                "/api/auth/invitation/accept", invitation);
        return new AuthRateLimitFilter(rateLimiter, limitsByPath, clientIpHeader);
    }

    private void unauthorized(HttpServletRequest request,
                               HttpServletResponse response,
                               AuthenticationException ex) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"error\":\"unauthorized\"}");
    }
}
