package com.curalithra.web;

import com.curalithra.web.security.DemoTokenRevocationService;
import com.curalithra.web.security.JwtService;
import com.curalithra.web.security.RateLimitService;
import com.fasterxml.jackson.databind.JsonNode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestPropertySource(properties = {
        "curalithra.demo.enabled=true",
        "curalithra.demo.seed-on-startup=true",
        "curalithra.security.jwt-secret=TestSecretKeyForCuralithraPublicDemoJwtSigning2026!",
        "curalithra.security.jwt-expiration-ms=28800000",
        "curalithra.security.demo-jwt-expiration-ms=1800000",
        "curalithra.security.cors-allowed-origins=https://alitrose.github.io,http://localhost:5173"
})
class DemoModeIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String TEST_SECRET = "TestSecretKeyForCuralithraPublicDemoJwtSigning2026!";

    @Autowired
    private JwtService jwtService;

    @Autowired
    private RateLimitService rateLimitService;

    @Autowired
    private DemoTokenRevocationService demoTokenRevocationService;

    @BeforeEach
    void resetSecurityState() {
        rateLimitService.resetAll();
        demoTokenRevocationService.clearForTests();
    }

    @Test
    void demoStatusListsThreeRolesWithoutExposingCredentialsAndBlocksSetup() throws Exception {
        mockMvc.perform(get("/api/auth/setup-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.setupRequired").value(false));

        mockMvc.perform(post("/api/auth/setup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Intruder Admin",
                                "username", "intruder.admin",
                                "email", "intruder@curalithra.demo",
                                "password", TEST_PASS,
                                "seedDemoData", false,
                                "createSampleRoleAccounts", false
                        ))))
                .andExpect(status().isForbidden());

        MvcResult statusRes = mockMvc.perform(get("/api/auth/demo-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.roles.length()").value(3))
                .andExpect(jsonPath("$.roles[0].role").value("ADMIN"))
                .andExpect(jsonPath("$.roles[0].title").value("Administrator Demo"))
                .andExpect(jsonPath("$.roles[0].highlights").isArray())
                .andExpect(jsonPath("$.roles[1].role").value("DOCTOR"))
                .andExpect(jsonPath("$.roles[1].title").value("Doctor Demo"))
                .andExpect(jsonPath("$.roles[1].highlights").isArray())
                .andExpect(jsonPath("$.roles[2].role").value("RECEPTIONIST"))
                .andExpect(jsonPath("$.roles[2].title").value("Receptionist Demo"))
                .andExpect(jsonPath("$.roles[2].highlights").isArray())
                .andReturn();

        String rawBody = statusRes.getResponse().getContentAsString();
        assertThat(rawBody).doesNotContain("username");
        assertThat(rawBody).doesNotContain("password");
        assertThat(rawBody).doesNotContain("demo.admin");
        assertThat(rawBody).doesNotContain("demo.doctor");
        assertThat(rawBody).doesNotContain("demo.reception");
    }

    @Test
    void demoLoginIssuesShortLivedScopedJwtsAndRejectsExpiryEscalationAndUnauthorizedCalls() throws Exception {
        // Unauthenticated requests fail cleanly
        mockMvc.perform(get("/api/patients")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/dashboard/stats")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/demo/reset")).andExpect(status().isUnauthorized());

        // Mint demo tokens across all 3 roles and verify claims & TTL
        for (String role : new String[]{"ADMIN", "DOCTOR", "RECEPTIONIST"}) {
            MvcResult loginRes = mockMvc.perform(post("/api/auth/demo-login")
                            .header("Origin", "https://alitrose.github.io")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("role", role))))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Access-Control-Allow-Origin", "https://alitrose.github.io"))
                    .andExpect(jsonPath("$.expiresInMs").value(1800000))
                    .andExpect(jsonPath("$.user.demoUser").value(true))
                    .andExpect(jsonPath("$.user.role").value(role))
                    .andReturn();

            String token = objectMapper.readTree(loginRes.getResponse().getContentAsString())
                    .get("accessToken").asText();
            Claims claims = jwtService.parseClaims(token);
            assertThat(claims.get("demo", Boolean.class)).isTrue();
            assertThat(claims.get("scope", String.class)).isEqualTo("DEMO_ONLY");
            assertThat(claims.get("role", String.class)).isEqualTo(role);
            long ttl = claims.getExpiration().getTime() - claims.getIssuedAt().getTime();
            assertThat(ttl).isEqualTo(1800000L);

            mockMvc.perform(get("/api/auth/me")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(header().string("X-Curalithra-Demo-Mode", "true"))
                    .andExpect(header().string("X-Curalithra-Demo-Role", role))
                    .andExpect(jsonPath("$.demoUser").value(true))
                    .andExpect(jsonPath("$.role").value(role));
        }

        // Direct password login with internal demo username must ALWAYS fail even with demoEnabled=true
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "usernameOrEmail", "demo.admin",
                                "password", "anything123"
                        ))))
                .andExpect(status().isUnauthorized());

        // Expired demo token rejected with 401
        SecretKey key = Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        Date past = new Date(System.currentTimeMillis() - 120_000L);
        String expiredJwt = Jwts.builder()
                .subject("demo.admin")
                .claim("uid", 1)
                .claim("role", "ADMIN")
                .claim("demo", true)
                .claim("scope", "DEMO_ONLY")
                .issuedAt(new Date(past.getTime() - 60_000L))
                .expiration(past)
                .signWith(key)
                .compact();

        mockMvc.perform(get("/api/dashboard/stats")
                        .header("Authorization", "Bearer " + expiredJwt))
                .andExpect(status().isUnauthorized());

        // Privilege-escalation / scope-spoofed JWTs rejected with 401
        Date future = new Date(System.currentTimeMillis() + 600_000L);
        String escalatedRoleJwt = Jwts.builder()
                .subject("demo.doctor")
                .claim("role", "ADMIN")
                .claim("demo", true)
                .claim("scope", "DEMO_ONLY")
                .issuedAt(new Date())
                .expiration(future)
                .signWith(key)
                .compact();

        mockMvc.perform(get("/api/users")
                        .header("Authorization", "Bearer " + escalatedRoleJwt))
                .andExpect(status().isUnauthorized());

        String spoofedStaffScopeJwt = Jwts.builder()
                .subject("demo.admin")
                .claim("role", "ADMIN")
                .claim("demo", false)
                .claim("scope", "STAFF")
                .issuedAt(new Date())
                .expiration(future)
                .signWith(key)
                .compact();

        mockMvc.perform(get("/api/patients")
                        .header("Authorization", "Bearer " + spoofedStaffScopeJwt))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void demoLoginSeedsBaselineDatasetEnforcesRbacIsolationResetProtectionAndCors() throws Exception {
        String demoAdminToken = demoLoginAndGetToken("ADMIN");
        String demoDoctorToken = demoLoginAndGetToken("DOCTOR");
        String demoReceptionToken = demoLoginAndGetToken("RECEPTIONIST");

        // Verify CORS preflight for GitHub Pages public site
        mockMvc.perform(options("/api/auth/demo-login")
                        .header("Origin", "https://alitrose.github.io")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Content-Type,Authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://alitrose.github.io"));

        // Verify seeded baseline volumes: 20 patients, 8 doctors, 8 departments, 12 appointments
        mockMvc.perform(get("/api/dashboard/stats")
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Curalithra-Demo-Mode", "true"))
                .andExpect(jsonPath("$.totalPatients").value(20))
                .andExpect(jsonPath("$.totalDoctors").value(8));

        mockMvc.perform(get("/api/doctors/departments")
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(8));

        mockMvc.perform(get("/api/appointments?size=50")
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(12));

        // RBAC preserved inside Demo Mode
        mockMvc.perform(get("/api/medical-records")
                        .header("Authorization", "Bearer " + demoDoctorToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/prescriptions")
                        .header("Authorization", "Bearer " + demoDoctorToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/medical-records")
                        .header("Authorization", "Bearer " + demoReceptionToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/billing")
                        .header("Authorization", "Bearer " + demoDoctorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", 1,
                                "items", java.util.List.of(Map.of(
                                        "description", "Consult",
                                        "category", "Consultation",
                                        "quantity", 1,
                                        "unitPrice", 500
                                ))
                        ))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/billing")
                        .header("Authorization", "Bearer " + demoReceptionToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/users")
                        .header("Authorization", "Bearer " + demoDoctorToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/reports/audit-logs")
                        .header("Authorization", "Bearer " + demoReceptionToken))
                .andExpect(status().isForbidden());

        // Non-destructive guardrails for Demo Mode
        long firstDemoPatientId = jdbcTemplate.queryForObject(
                "SELECT id FROM patients WHERE is_demo = TRUE ORDER BY id LIMIT 1", Long.class);
        long firstDemoDoctorId = jdbcTemplate.queryForObject(
                "SELECT id FROM doctors WHERE is_demo = TRUE ORDER BY id LIMIT 1", Long.class);
        long firstDemoBillId = jdbcTemplate.queryForObject(
                "SELECT id FROM bills WHERE is_demo = TRUE ORDER BY id LIMIT 1", Long.class);

        mockMvc.perform(delete("/api/patients/" + firstDemoPatientId)
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/doctors/" + firstDemoDoctorId)
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/billing/" + firstDemoBillId)
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/settings")
                        .header("Authorization", "Bearer " + demoAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "hospitalName", "Tampered Hospital",
                                "tagline", "Tampered",
                                "defaultTaxRate", 0.10,
                                "defaultAppointmentMinutes", 15,
                                "currencyCode", "USD",
                                "currencySymbol", "$",
                                "supportEmail", "",
                                "supportPhone", "",
                                "address", "",
                                "invoiceFooterNote", ""
                        ))))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/users")
                        .header("Authorization", "Bearer " + demoAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Blocked User",
                                "username", "blocked.user",
                                "email", "blocked@curalithra.demo",
                                "password", TEST_PASS,
                                "role", "RECEPTIONIST"
                        ))))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/auth/me")
                        .header("Authorization", "Bearer " + demoAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Renamed Demo Admin",
                                "email", "renamed@curalithra.demo"
                        ))))
                .andExpect(status().isForbidden());

        // Strict isolation: create a non-demo (real) user and patient in DB and verify Demo users never see them
        // AND real user cannot invoke /api/demo/reset
        jdbcTemplate.update("""
                INSERT INTO users (username, full_name, email, password_hash, role, active, is_demo)
                VALUES ('real.admin', 'Real Hospital Admin', 'real@hospital.org', '$2a$12$dummyhashvalueforisolationcheck', 'ADMIN', TRUE, FALSE)
                """);
        long realAdminId = jdbcTemplate.queryForObject(
                "SELECT id FROM users WHERE username = 'real.admin'", Long.class);
        jdbcTemplate.update("""
                INSERT INTO patients (patient_code, full_name, date_of_birth, gender, phone, blood_group, is_demo)
                VALUES ('PAT-99999', 'Confidential Production Patient', '1980-01-01', 'Female', '+91 99999 00001', 'O+', FALSE)
                """);
        long realPatientId = jdbcTemplate.queryForObject(
                "SELECT id FROM patients WHERE patient_code = 'PAT-99999'", Long.class);

        SecretKey key = Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        String realAdminJwt = Jwts.builder()
                .subject("real.admin")
                .claim("uid", realAdminId)
                .claim("role", "ADMIN")
                .claim("demo", false)
                .claim("scope", "STAFF")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 600_000L))
                .signWith(key)
                .compact();

        mockMvc.perform(post("/api/demo/reset")
                        .header("Authorization", "Bearer " + realAdminJwt))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/users")
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));

        mockMvc.perform(get("/api/patients/" + realPatientId)
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isNotFound());

        // Read-Only Shared Demo guardrails: all demo creates/updates/status changes/resets return 403 Forbidden
        // while keeping baseline seeded counts (20 patients) and real production data (PAT-99999) untouched.
        mockMvc.perform(post("/api/patients")
                        .header("Authorization", "Bearer " + demoReceptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.ofEntries(
                                Map.entry("fullName", "Blocked Demo Visitor"),
                                Map.entry("dateOfBirth", "1993-05-11"),
                                Map.entry("gender", "Male"),
                                Map.entry("phone", "+91 90100 39999"),
                                Map.entry("email", "visitor@curalithra-demo.example"),
                                Map.entry("address", "Demo Wing"),
                                Map.entry("bloodGroup", "A+"),
                                Map.entry("emergencyContact", "Desk"),
                                Map.entry("bp", "120/80"),
                                Map.entry("sugar", "95"),
                                Map.entry("weightKg", "70"),
                                Map.entry("heightCm", "175")
                        ))))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/patients/" + firstDemoPatientId)
                        .header("Authorization", "Bearer " + demoAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Edited Demo Patient",
                                "dateOfBirth", "1988-04-12",
                                "gender", "Male",
                                "phone", "+91 90100 30001",
                                "bloodGroup", "O+"
                        ))))
                .andExpect(status().isForbidden());

        long firstDemoDeptId = jdbcTemplate.queryForObject(
                "SELECT id FROM departments WHERE is_demo = TRUE ORDER BY id LIMIT 1", Long.class);

        mockMvc.perform(post("/api/doctors")
                        .header("Authorization", "Bearer " + demoAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Dr. Blocked Demo",
                                "specialization", "Cardiology",
                                "departmentId", firstDemoDeptId,
                                "phone", "+91 90100 55555",
                                "email", "blocked.doc@curalithra.demo",
                                "qualification", "MD",
                                "experienceYears", 5,
                                "availabilitySchedule", "Mon-Fri 09:00-17:00",
                                "consultationFee", 500,
                                "active", true
                        ))))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/appointments")
                        .header("Authorization", "Bearer " + demoReceptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", firstDemoPatientId,
                                "doctorId", firstDemoDoctorId,
                                "appointmentDate", java.time.LocalDate.now().plusDays(10).toString(),
                                "appointmentTime", "15:00",
                                "durationMinutes", 30,
                                "reason", "Blocked Demo Booking"
                        ))))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/medical-records")
                        .header("Authorization", "Bearer " + demoDoctorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", firstDemoPatientId,
                                "doctorId", firstDemoDoctorId,
                                "visitDate", java.time.LocalDate.now().toString(),
                                "symptoms", "Chest discomfort",
                                "diagnosis", "Read-only test",
                                "treatment", "None",
                                "prescriptions", java.util.List.of()
                        ))))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/prescriptions")
                        .header("Authorization", "Bearer " + demoDoctorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", firstDemoPatientId,
                                "doctorId", firstDemoDoctorId,
                                "medicationName", "Atorvastatin",
                                "dosage", "10 mg",
                                "frequency", "Once nightly",
                                "durationDays", 30
                        ))))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/billing")
                        .header("Authorization", "Bearer " + demoReceptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", firstDemoPatientId,
                                "items", java.util.List.of(Map.of(
                                        "description", "Blocked Demo Consult",
                                        "category", "Consultation",
                                        "quantity", 1,
                                        "unitPrice", 500
                                ))
                        ))))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/notifications/mark-all-read")
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/demo/reset")
                        .header("Authorization", "Bearer " + demoReceptionToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/patients")
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(20));

        Integer realPatientStillPresent = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM patients WHERE patient_code = 'PAT-99999' AND is_demo = FALSE", Integer.class);
        assertThat(realPatientStillPresent).isEqualTo(1);
    }

    @Test
    void demoLogoutImmediatelyRevokesDemoJwtWhileLeavingOtherSessionsActive() throws Exception {
        String adminDemoJwt = demoLoginAndGetToken("ADMIN");
        String doctorDemoJwt = demoLoginAndGetToken("DOCTOR");

        assertThat(jwtService.parseClaims(adminDemoJwt).getId()).isNotBlank();
        assertThat(jwtService.parseClaims(doctorDemoJwt).getId()).isNotBlank();
        assertThat(jwtService.parseClaims(adminDemoJwt).getId())
                .isNotEqualTo(jwtService.parseClaims(doctorDemoJwt).getId());

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + adminDemoJwt))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer " + adminDemoJwt))
                .andExpect(status().isNoContent());

        // Revoked demo JWT must be rejected everywhere on subsequent requests
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + adminDemoJwt))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/patients")
                        .header("Authorization", "Bearer " + adminDemoJwt))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/dashboard/stats")
                        .header("Authorization", "Bearer " + adminDemoJwt))
                .andExpect(status().isUnauthorized());

        // Separate active demo session with its own jti continues working
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + doctorDemoJwt))
                .andExpect(status().isOk());
    }

    @Test
    void serverSideRateLimitingThrottlesDemoLoginDemoResetAndDemoMutations() throws Exception {
        String demoAdminToken = demoLoginAndGetToken("ADMIN");

        // 1. Rate-limit POST /api/demo/reset (limit = 5 / window)
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/demo/reset")
                            .header("Authorization", "Bearer " + demoAdminToken))
                    .andExpect(status().isForbidden())
                    .andExpect(header().string("X-RateLimit-Limit", "5"));
        }
        mockMvc.perform(post("/api/demo/reset")
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(header().string("X-RateLimit-Remaining", "0"))
                .andExpect(jsonPath("$.status").value(429));

        // 2. Rate-limit demo mutations (limit = 15 / window) without blocking GET reads
        String patientPayload = objectMapper.writeValueAsString(Map.of(
                "fullName", "Rate Limited Patient",
                "dateOfBirth", "1993-05-11",
                "gender", "Male",
                "phone", "+91 90100 39991",
                "bloodGroup", "A+"
        ));
        for (int i = 0; i < 15; i++) {
            mockMvc.perform(post("/api/patients")
                            .header("Authorization", "Bearer " + demoAdminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(patientPayload))
                    .andExpect(status().isForbidden())
                    .andExpect(header().string("X-RateLimit-Limit", "15"));
        }
        mockMvc.perform(post("/api/patients")
                        .header("Authorization", "Bearer " + demoAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patientPayload))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(header().string("X-RateLimit-Remaining", "0"))
                .andExpect(jsonPath("$.status").value(429));

        // Read endpoints remain available for the demo session
        mockMvc.perform(get("/api/patients")
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isOk());

        // 3. Rate-limit POST /api/auth/demo-login (limit = 20 / window; 1 call already made above)
        for (int i = 1; i < 20; i++) {
            mockMvc.perform(post("/api/auth/demo-login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("role", "DOCTOR"))))
                    .andExpect(status().isOk())
                    .andExpect(header().string("X-RateLimit-Limit", "20"));
        }
        mockMvc.perform(post("/api/auth/demo-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("role", "DOCTOR"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(header().string("X-RateLimit-Remaining", "0"))
                .andExpect(jsonPath("$.status").value(429));
    }

    private String demoLoginAndGetToken(String role) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/auth/demo-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("role", role))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.demoUser").value(true))
                .andExpect(jsonPath("$.user.role").value(role))
                .andReturn();
        JsonNode json = objectMapper.readTree(res.getResponse().getContentAsString());
        return json.get("accessToken").asText();
    }
}
