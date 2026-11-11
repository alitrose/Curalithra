package com.curalithra.web;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestPropertySource(properties = {
        "curalithra.demo.enabled=true",
        "curalithra.demo.seed-on-startup=true"
})
class DemoModeIntegrationTest extends AbstractPostgresIntegrationTest {

    @Test
    void demoStatusListsThreeRolesAndBlocksSetupWizardWhenDemoEnabled() throws Exception {
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

        mockMvc.perform(get("/api/auth/demo-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.roles.length()").value(3))
                .andExpect(jsonPath("$.roles[0].role").value("ADMIN"))
                .andExpect(jsonPath("$.roles[1].role").value("DOCTOR"))
                .andExpect(jsonPath("$.roles[2].role").value("RECEPTIONIST"));
    }

    @Test
    void demoLoginSeedsBaselineDatasetEnforcesRbacIsolationAndNonDestructiveSafety() throws Exception {
        String demoAdminToken = demoLoginAndGetToken("ADMIN");
        String demoDoctorToken = demoLoginAndGetToken("DOCTOR");
        String demoReceptionToken = demoLoginAndGetToken("RECEPTIONIST");

        // Verify seeded baseline volumes: 20 patients, 8 doctors, 8 departments, 12 appointments
        mockMvc.perform(get("/api/dashboard/stats")
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isOk())
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
        jdbcTemplate.update("""
                INSERT INTO users (username, full_name, email, password_hash, role, active, is_demo)
                VALUES ('real.admin', 'Real Hospital Admin', 'real@hospital.org', '$2a$12$dummyhashvalueforisolationcheck', 'ADMIN', TRUE, FALSE)
                """);
        jdbcTemplate.update("""
                INSERT INTO patients (patient_code, full_name, date_of_birth, gender, phone, blood_group, is_demo)
                VALUES ('PAT-99999', 'Confidential Production Patient', '1980-01-01', 'Female', '+91 99999 00001', 'O+', FALSE)
                """);
        long realPatientId = jdbcTemplate.queryForObject(
                "SELECT id FROM patients WHERE patient_code = 'PAT-99999'", Long.class);

        mockMvc.perform(get("/api/users")
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));

        mockMvc.perform(get("/api/patients/" + realPatientId)
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isNotFound());

        // Sandbox mutation allowed on demo scope, then reset restores 20 patients without touching real rows
        mockMvc.perform(post("/api/patients")
                        .header("Authorization", "Bearer " + demoReceptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.ofEntries(
                                Map.entry("fullName", "Temporary Demo Visitor"),
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
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/patients")
                        .header("Authorization", "Bearer " + demoAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(21));

        MvcResult resetRes = mockMvc.perform(post("/api/demo/reset")
                        .header("Authorization", "Bearer " + demoReceptionToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.patientsCount").value(20))
                .andExpect(jsonPath("$.doctorsCount").value(8))
                .andExpect(jsonPath("$.appointmentsCount").value(12))
                .andReturn();

        String refreshedToken = objectMapper.readTree(resetRes.getResponse().getContentAsString())
                .get("session").get("accessToken").asText();

        mockMvc.perform(get("/api/dashboard/stats")
                        .header("Authorization", "Bearer " + refreshedToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPatients").value(20));

        Integer realPatientStillPresent = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM patients WHERE patient_code = 'PAT-99999' AND is_demo = FALSE", Integer.class);
        assertThat(realPatientStillPresent).isEqualTo(1);
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
