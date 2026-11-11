package com.curalithra.web.controller;

import com.curalithra.web.dto.AuthDtos;
import com.curalithra.web.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AuthService authService;

    public UserController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping
    public List<AuthDtos.UserSummaryDto> listStaff() {
        return authService.listAllStaff();
    }

    @PostMapping
    public ResponseEntity<AuthDtos.UserSummaryDto> createStaff(@Valid @RequestBody AuthDtos.CreateUserRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.createStaffUser(req));
    }

    @PatchMapping("/{id}")
    public AuthDtos.UserSummaryDto updateStaffAccess(
            @PathVariable long id,
            @Valid @RequestBody AuthDtos.UpdateUserAccessRequest req) {
        return authService.updateUserRoleAndStatus(id, req);
    }
}
