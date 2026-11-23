package com.training.tracking.security;

import com.training.tracking.repository.UserRepository;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.stereotype.Component;

import java.util.function.Supplier;

/**
 * Lets a request through to /api/admin/** only for an active admin. Looked up in the database on
 * every call rather than carried in the access token, so taking the flag away or deactivating the
 * account takes effect at once instead of when the token expires.
 */
@Component
public class AdminAccess implements AuthorizationManager<RequestAuthorizationContext> {

    private final UserRepository userRepository;

    public AdminAccess(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public AuthorizationDecision check(Supplier<Authentication> authentication, RequestAuthorizationContext context) {
        boolean granted = authentication.get().getPrincipal() instanceof UserPrincipal principal
                && userRepository.findById(principal.id())
                        .map(user -> user.isAdmin() && user.isActive())
                        .orElse(false);
        return new AuthorizationDecision(granted);
    }
}
