package com.curalithra.web.controller;

import com.curalithra.web.dto.AuthDtos;
import com.curalithra.web.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/setup-status")
    public AuthDtos.SetupStatusResponse setupStatus() {
        return new AuthDtos.SetupStatusResponse(authService.isSetupRequired());
    }

    @PostMapping("/setup")
    public ResponseEntity<AuthDtos.AuthResponse> setup(@Valid @RequestBody AuthDtos.InitialSetupRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.setupInitialWorkspace(req));
    }

    @PostMapping("/login")
    public AuthDtos.AuthResponse login(@Valid @RequestBody AuthDtos.LoginRequest req) {
        return authService.login(req);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        authService.logout();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public AuthDtos.UserSummaryDto me() {
        return authService.currentProfile();
    }

    @PutMapping("/me")
    public AuthDtos.UserSummaryDto updateMe(@Valid @RequestBody AuthDtos.UpdateProfileRequest req) {
        return authService.updateOwnProfile(req);
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody AuthDtos.ChangePasswordRequest req) {
        authService.changeOwnPassword(req);
        return ResponseEntity.noContent().build();
    }
}
