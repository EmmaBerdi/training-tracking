package com.training.tracking.web;

import com.training.tracking.dto.auth.ChangePasswordRequest;
import com.training.tracking.security.UserPrincipal;
import com.training.tracking.service.AuthService;
import com.training.tracking.service.PasswordService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Calls on the logged-in user's own account. Deliberately outside /api/auth, which is open to
 * anonymous callers: everything here needs the bearer token.
 */
@RestController
@RequestMapping("/api/account")
public class AccountController {

    private final PasswordService passwordService;
    private final AuthService authService;

    public AccountController(PasswordService passwordService, AuthService authService) {
        this.passwordService = passwordService;
        this.authService = authService;
    }

    @PostMapping("/password")
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal UserPrincipal principal,
                                               @Valid @RequestBody ChangePasswordRequest request) {
        passwordService.changePassword(principal.id(), request.currentPassword(), request.newPassword());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/logout-all")
    public ResponseEntity<Void> logoutAll(@AuthenticationPrincipal UserPrincipal principal) {
        authService.logoutAll(principal.id());
        return ResponseEntity.noContent().build();
    }
}
