package com.curalithra.web.dto;

import com.curalithra.web.enums.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

public final class AuthDtos {
    private AuthDtos() {}

    public record SetupStatusResponse(boolean setupRequired) {}

    public record DemoRoleInfoDto(
            Role role,
            String title,
            String username,
            String summary,
            String accessScope
    ) {}

    public record DemoStatusResponse(
            boolean enabled,
            String notice,
            List<DemoRoleInfoDto> roles
    ) {}

    public record DemoLoginRequest(
            @NotNull(message = "Demo role is required.")
            Role role
    ) {}

    public record DemoResetResponse(
            String message,
            AuthResponse session,
            long patientsCount,
            long doctorsCount,
            long appointmentsCount
    ) {}

    public record InitialSetupRequest(
            @NotBlank(message = "Administrator full name is required.")
            @Size(max = 150)
            String fullName,

            @NotBlank(message = "Username is required.")
            @Pattern(regexp = "^[A-Za-z0-9._-]{3,32}$", message = "Username must be 3-32 characters (letters, numbers, ., _, -).")
            String username,

            @Email(message = "Please enter a valid email address.")
            String email,

            @NotBlank(message = "Passphrase is required.")
            @Size(min = 6, max = 128, message = "Passphrase must be between 6 and 128 characters.")
            String password,

            boolean seedDemoData,
            boolean createSampleRoleAccounts
    ) {}

    public record LoginRequest(
            @NotBlank(message = "Username or email is required.")
            String usernameOrEmail,

            @NotBlank(message = "Password is required.")
            String password
    ) {}

    public record UserSummaryDto(
            Long id,
            String username,
            String fullName,
            String email,
            Role role,
            String roleDisplay,
            Long linkedDoctorId,
            boolean active,
            boolean demoUser,
            OffsetDateTime createdAt,
            OffsetDateTime lastLoginAt,
            Set<String> permissions
    ) {}

    public record AuthResponse(
            String accessToken,
            String tokenType,
            long expiresInMs,
            UserSummaryDto user
    ) {}

    public record CreateUserRequest(
            @NotBlank(message = "Full name is required.")
            @Size(max = 150)
            String fullName,

            @NotBlank(message = "Username is required.")
            @Pattern(regexp = "^[A-Za-z0-9._-]{3,32}$", message = "Username must be 3-32 characters (letters, numbers, ., _, -).")
            String username,

            @Email(message = "Please enter a valid email address.")
            String email,

            @NotBlank(message = "Password is required.")
            @Size(min = 6, max = 128, message = "Password must be at least 6 characters.")
            String password,

            @NotNull(message = "Staff role is required.")
            Role role,

            Long linkedDoctorId
    ) {}

    public record UpdateUserAccessRequest(
            @NotNull(message = "Staff role is required.")
            Role role,
            boolean active,
            Long linkedDoctorId,
            @Size(max = 128, message = "Password cannot exceed 128 characters.")
            String resetPassword
    ) {
        public UpdateUserAccessRequest(Role role, boolean active) {
            this(role, active, null, null);
        }
    }

    public record UpdateProfileRequest(
            @NotBlank(message = "Full name is required.")
            @Size(max = 150)
            String fullName,

            @Email(message = "Please enter a valid email address.")
            String email
    ) {}

    public record ChangePasswordRequest(
            @NotBlank(message = "Current password is required.")
            String currentPassword,

            @NotBlank(message = "New password is required.")
            @Size(min = 6, max = 128, message = "New password must be at least 6 characters.")
            String newPassword
    ) {}
}
