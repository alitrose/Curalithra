package com.curalithra.web.service;

import com.curalithra.web.dto.AuthDtos;
import com.curalithra.web.entity.UserEntity;
import com.curalithra.web.enums.Role;
import com.curalithra.web.enums.RolePermission;
import com.curalithra.web.exception.AuthorizationException;
import com.curalithra.web.exception.ConflictException;
import com.curalithra.web.exception.NotFoundException;
import com.curalithra.web.exception.ValidationException;
import com.curalithra.web.repository.DoctorRepository;
import com.curalithra.web.repository.UserRepository;
import com.curalithra.web.security.CuralithraUserPrincipal;
import com.curalithra.web.security.DemoTokenRevocationService;
import com.curalithra.web.security.JwtService;
import com.curalithra.web.security.PermissionService;
import com.curalithra.web.util.DomainValidators;
import com.curalithra.web.util.DtoMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final DoctorRepository doctorRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final PermissionService permissionService;
    private final SeedDataService seedDataService;
    private final AuditLogService auditLogService;
    private final DemoTokenRevocationService demoTokenRevocationService;
    private final Clock clock;
    private final boolean demoEnabled;

    public AuthService(UserRepository userRepository,
                       DoctorRepository doctorRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       PermissionService permissionService,
                       SeedDataService seedDataService,
                       AuditLogService auditLogService,
                       DemoTokenRevocationService demoTokenRevocationService,
                       Clock clock,
                       @Value("${curalithra.demo.enabled:false}") boolean demoEnabled) {
        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.permissionService = permissionService;
        this.seedDataService = seedDataService;
        this.auditLogService = auditLogService;
        this.demoTokenRevocationService = demoTokenRevocationService;
        this.clock = clock;
        this.demoEnabled = demoEnabled;
    }

    @Transactional(readOnly = true)
    public boolean isSetupRequired() {
        return !demoEnabled && userRepository.countByDemoUserFalse() == 0;
    }

    @Transactional
    public AuthDtos.AuthResponse setupInitialWorkspace(AuthDtos.InitialSetupRequest req) {
        if (demoEnabled) {
            throw new AuthorizationException(HttpStatus.FORBIDDEN,
                    "Workspace setup is disabled while Public Demo Mode is active.");
        }
        if (userRepository.countByDemoUserFalse() > 0) {
            throw new ConflictException("Initial workspace setup has already been completed.");
        }
        String cleanName = DomainValidators.requireNonBlank(req.fullName(), "Administrator full name");
        String cleanUser = DomainValidators.validateUsername(req.username());
        if (cleanUser.toLowerCase(Locale.ROOT).startsWith("demo.")) {
            throw new ValidationException("Usernames starting with 'demo.' are reserved for Public Demo accounts.");
        }
        String cleanEmail = DomainValidators.validateEmail(req.email(), false);

        OffsetDateTime now = OffsetDateTime.now(clock);
        UserEntity admin = new UserEntity();
        admin.setFullName(cleanName);
        admin.setUsername(cleanUser);
        admin.setEmail(cleanEmail.isEmpty() ? null : cleanEmail);
        admin.setPasswordHash(passwordEncoder.encode(req.password()));
        admin.setRole(Role.ADMIN);
        admin.setActive(true);
        admin.setDemoUser(false);
        admin.setCreatedAt(now);
        admin.setLastLoginAt(now);

        UserEntity savedAdmin = userRepository.save(admin);
        seedDataService.ensureDefaultDepartments();
        if (req.seedDemoData()) {
            seedDataService.seedSyntheticHospitalDataset(savedAdmin, req.password(), req.createSampleRoleAccounts());
        }

        auditLogService.record(savedAdmin, "SETUP", "USER", String.valueOf(savedAdmin.getId()),
                "Initialized CURALITHRA Web workspace and administrator account");

        String token = jwtService.generateToken(savedAdmin);
        return new AuthDtos.AuthResponse(token, "Bearer", jwtService.getExpirationMs(savedAdmin), DtoMapper.toUserSummary(savedAdmin));
    }

    @Transactional
    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest req) {
        String identifier = DomainValidators.requireNonBlank(req.usernameOrEmail(), "Username or email");
        Optional<UserEntity> found = identifier.contains("@")
                ? userRepository.findByEmailIgnoreCase(identifier)
                : userRepository.findByUsernameIgnoreCase(identifier);
        if (found.isEmpty()) {
            found = userRepository.findByUsernameIgnoreCase(identifier);
        }

        UserEntity user = found.orElseThrow(() ->
                new AuthorizationException(HttpStatus.UNAUTHORIZED, "Invalid username/email or password."));

        if (user.isDemoUser()) {
            throw new AuthorizationException(HttpStatus.UNAUTHORIZED, "Invalid username/email or password.");
        }
        if (!user.isActive()) {
            throw new AuthorizationException(HttpStatus.UNAUTHORIZED,
                    "This staff account is deactivated. Contact your Administrator.");
        }
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new AuthorizationException(HttpStatus.UNAUTHORIZED, "Invalid username/email or password.");
        }

        user.setLastLoginAt(OffsetDateTime.now(clock));
        userRepository.save(user);
        auditLogService.record(user, "LOGIN", "SESSION", user.getUsername(),
                "Signed in as " + user.getRole().getDisplayName());

        String token = jwtService.generateToken(user);
        return new AuthDtos.AuthResponse(token, "Bearer", jwtService.getExpirationMs(user), DtoMapper.toUserSummary(user));
    }

    @Transactional
    public void logout() {
        CuralithraUserPrincipal principal = permissionService.requireAuthenticatedPrincipal();
        if (principal.isDemoUser() && principal.getTokenJti() != null) {
            demoTokenRevocationService.revoke(principal.getTokenJti(), principal.getTokenExpiresAt());
        }
        UserEntity current = permissionService.requireCurrentUserEntity();
        auditLogService.record(current, "LOGOUT", "SESSION", current.getUsername(), "Signed out of CURALITHRA Web");
    }

    @Transactional(readOnly = true)
    public AuthDtos.UserSummaryDto currentProfile() {
        return DtoMapper.toUserSummary(permissionService.requireCurrentUserEntity());
    }

    @Transactional
    public AuthDtos.UserSummaryDto updateOwnProfile(AuthDtos.UpdateProfileRequest req) {
        permissionService.forbidDemoMutation("Editing demo account profile details");
        UserEntity current = permissionService.requireCurrentUserEntity();
        String cleanName = DomainValidators.requireNonBlank(req.fullName(), "Full name");
        String cleanEmail = DomainValidators.validateEmail(req.email(), false);
        if (!cleanEmail.isEmpty()) {
            userRepository.findByEmailIgnoreCase(cleanEmail).ifPresent(other -> {
                if (!other.getId().equals(current.getId())) {
                    throw new ConflictException("Email '" + cleanEmail + "' is already assigned to another staff account.");
                }
            });
        }
        current.setFullName(cleanName);
        current.setEmail(cleanEmail.isEmpty() ? null : cleanEmail);
        UserEntity saved = userRepository.save(current);
        auditLogService.record(saved, "UPDATE", "USER", String.valueOf(saved.getId()),
                "Updated own staff profile");
        return DtoMapper.toUserSummary(saved);
    }

    @Transactional(readOnly = true)
    public List<AuthDtos.UserSummaryDto> listAllStaff() {
        permissionService.requirePermission(RolePermission.MANAGE_USERS);
        boolean demoScope = permissionService.isCurrentDemoUser();
        return userRepository.findByDemoUserOrderByCreatedAtDesc(demoScope).stream()
                .map(DtoMapper::toUserSummary)
                .toList();
    }

    @Transactional
    public AuthDtos.UserSummaryDto createStaffUser(AuthDtos.CreateUserRequest req) {
        permissionService.requirePermission(RolePermission.MANAGE_USERS);
        permissionService.forbidDemoMutation("Creating staff user accounts");
        UserEntity actor = permissionService.requireCurrentUserEntity();

        String cleanName = DomainValidators.requireNonBlank(req.fullName(), "Full name");
        String cleanUsername = DomainValidators.validateUsername(req.username());
        if (cleanUsername.toLowerCase(Locale.ROOT).startsWith("demo.")) {
            throw new ValidationException("Usernames starting with 'demo.' are reserved for Public Demo accounts.");
        }
        String cleanEmail = DomainValidators.validateEmail(req.email(), false);

        if (userRepository.existsByUsernameIgnoreCase(cleanUsername)) {
            throw new ConflictException("Username '" + cleanUsername + "' is already taken.");
        }
        if (!cleanEmail.isEmpty() && userRepository.existsByEmailIgnoreCase(cleanEmail)) {
            throw new ConflictException("Email '" + cleanEmail + "' is already assigned to another staff account.");
        }
        if (req.linkedDoctorId() != null && doctorRepository.findById(req.linkedDoctorId())
                .filter(d -> !d.isDemoRecord()).isEmpty()) {
            throw new ValidationException("Selected linked doctor does not exist.");
        }

        UserEntity u = new UserEntity();
        u.setFullName(cleanName);
        u.setUsername(cleanUsername);
        u.setEmail(cleanEmail.isEmpty() ? null : cleanEmail);
        u.setPasswordHash(passwordEncoder.encode(req.password()));
        u.setRole(req.role());
        u.setLinkedDoctorId(req.linkedDoctorId());
        u.setActive(true);
        u.setDemoUser(false);
        u.setCreatedAt(OffsetDateTime.now(clock));

        UserEntity saved = userRepository.save(u);
        auditLogService.record(actor, "CREATE", "USER", String.valueOf(saved.getId()),
                "Created staff user " + saved.getUsername() + " (" + saved.getRole().getDisplayName() + ")");
        return DtoMapper.toUserSummary(saved);
    }

    @Transactional
    public AuthDtos.UserSummaryDto updateUserRoleAndStatus(long targetUserId, AuthDtos.UpdateUserAccessRequest req) {
        permissionService.requirePermission(RolePermission.MANAGE_USERS);
        permissionService.forbidDemoMutation("Modifying staff roles or account status");
        UserEntity actor = permissionService.requireCurrentUserEntity();
        if (actor.getId().equals(targetUserId) && (!req.active() || req.role() != Role.ADMIN)) {
            throw new ValidationException("You cannot deactivate or demote your own active Administrator account.");
        }

        UserEntity target = userRepository.findById(targetUserId)
                .filter(u -> !u.isDemoUser())
                .orElseThrow(() -> new NotFoundException("Staff user not found."));
        target.setRole(req.role());
        target.setActive(req.active());
        if (req.linkedDoctorId() != null) {
            if (doctorRepository.findById(req.linkedDoctorId()).filter(d -> !d.isDemoRecord()).isEmpty()) {
                throw new ValidationException("Selected linked doctor does not exist.");
            }
            target.setLinkedDoctorId(req.linkedDoctorId());
        } else if (req.role() != Role.DOCTOR) {
            target.setLinkedDoctorId(null);
        }
        if (req.resetPassword() != null && !req.resetPassword().isBlank()) {
            if (req.resetPassword().length() < 6) {
                throw new ValidationException("Reset password must be at least 6 characters.");
            }
            target.setPasswordHash(passwordEncoder.encode(req.resetPassword()));
        }
        UserEntity updated = userRepository.save(target);

        auditLogService.record(actor, "UPDATE", "USER", String.valueOf(targetUserId),
                "Updated " + target.getUsername() + " -> role=" + req.role().getDisplayName() + ", active=" + req.active());
        return DtoMapper.toUserSummary(updated);
    }

    @Transactional
    public void changeOwnPassword(AuthDtos.ChangePasswordRequest req) {
        permissionService.forbidDemoMutation("Changing shared demo account passwords");
        UserEntity current = permissionService.requireCurrentUserEntity();
        if (!passwordEncoder.matches(req.currentPassword(), current.getPasswordHash())) {
            throw new AuthorizationException(HttpStatus.BAD_REQUEST, "Current password is incorrect.");
        }
        current.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(current);
        auditLogService.record(current, "UPDATE", "USER", String.valueOf(current.getId()),
                "Updated account password");
    }
}
