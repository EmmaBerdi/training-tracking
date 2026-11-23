package com.training.tracking.web;

import com.training.tracking.dto.admin.AdminUserDto;
import com.training.tracking.dto.admin.DeleteUserRequest;
import com.training.tracking.dto.admin.InvitationResponse;
import com.training.tracking.dto.admin.InviteUserRequest;
import com.training.tracking.security.UserPrincipal;
import com.training.tracking.service.AdminUserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Account management. Only admins get past SecurityConfig to here (see AdminAccess). */
@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public List<AdminUserDto> list() {
        return adminUserService.list();
    }

    @PostMapping
    public ResponseEntity<InvitationResponse> invite(@Valid @RequestBody InviteUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminUserService.invite(request));
    }

    @PostMapping("/{id}/invitation")
    public InvitationResponse resendInvitation(@PathVariable Long id) {
        return adminUserService.resendInvitation(id);
    }

    @PostMapping("/{id}/deactivate")
    public AdminUserDto deactivate(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id) {
        return adminUserService.deactivate(principal.id(), id);
    }

    @PostMapping("/{id}/reactivate")
    public AdminUserDto reactivate(@PathVariable Long id) {
        return adminUserService.reactivate(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserPrincipal principal,
                                       @PathVariable Long id,
                                       @Valid @RequestBody DeleteUserRequest request) {
        adminUserService.delete(principal.id(), id, request.confirmEmail());
        return ResponseEntity.noContent().build();
    }
}
