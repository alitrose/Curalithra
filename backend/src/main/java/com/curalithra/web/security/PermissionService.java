package com.curalithra.web.security;

import com.curalithra.web.entity.UserEntity;
import com.curalithra.web.enums.RolePermission;
import com.curalithra.web.exception.AuthorizationException;
import com.curalithra.web.exception.NotFoundException;
import com.curalithra.web.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class PermissionService {

    private final UserRepository userRepository;

    public PermissionService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public CuralithraUserPrincipal requireAuthenticatedPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof CuralithraUserPrincipal principal) || !principal.isActive()) {
            throw new AuthorizationException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }
        return principal;
    }

    public UserEntity requireCurrentUserEntity() {
        CuralithraUserPrincipal principal = requireAuthenticatedPrincipal();
        return userRepository.findById(principal.getId())
                .filter(UserEntity::isActive)
                .orElseThrow(() -> new AuthorizationException(HttpStatus.UNAUTHORIZED, "User session is no longer active."));
    }

    public boolean isCurrentDemoUser() {
        return requireAuthenticatedPrincipal().isDemoUser();
    }

    public void forbidDemoMutation(String actionDescription) {
        if (isCurrentDemoUser()) {
            throw new AuthorizationException(HttpStatus.FORBIDDEN,
                    actionDescription + " is disabled in Public Demo Mode. Use 'Reset Demo Data' to restore the demo dataset.");
        }
    }

    public void verifySameScope(boolean entityIsDemo, String resourceLabel) {
        if (entityIsDemo != isCurrentDemoUser()) {
            throw new NotFoundException(resourceLabel + " not found.");
        }
    }

    public boolean hasPermission(RolePermission permission) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof CuralithraUserPrincipal principal) || !principal.isActive()) {
            return false;
        }
        return RolePermission.hasPermission(principal.getRole(), permission);
    }

    public void requirePermission(RolePermission permission) {
        CuralithraUserPrincipal principal = requireAuthenticatedPrincipal();
        if (!RolePermission.hasPermission(principal.getRole(), permission)) {
            throw new AuthorizationException(
                    "Access denied: " + principal.getRole().getDisplayName()
                            + " does not have permission (" + permission.name() + ").");
        }
    }
}
