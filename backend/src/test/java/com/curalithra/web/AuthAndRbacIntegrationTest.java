package com.curalithra.web;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AuthAndRbacIntegrationTest extends AbstractPostgresIntegrationTest {

    @Test
    void unauthenticatedRequestsReturn401() throws Exception {
        mockMvc.perform(get("/api/patients"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void firstRunSetupLocksAgainstRepeatCallsAndSeedsRolesWithBcrypt() throws Exception {
        String adminToken = setupDemoWorkspaceAndGetAdminToken();
        assertThat(adminToken).isNotBlank();

        mockMvc.perform(get("/api/auth/setup-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.setupRequired").value(false));

        String repeatBody = objectMapper.writeValueAsString(Map.of(
                "fullName", "Another Admin",
                "username", "admin2",
                "email", "admin2@curalithra.demo",
                "password", TEST_PASS,
                "seedDemoData", false,
                "createSampleRoleAccounts", false
        ));
        mockMvc.perform(post("/api/auth/setup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(repeatBody))
                .andExpect(status().isConflict());

        String hash = jdbcTemplate.queryForObject(
                "SELECT password_hash FROM users WHERE username = ?", String.class, TEST_ADMIN_USER);
        assertThat(hash).startsWith("$2");

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.demoUser").value(false))
                .andExpect(jsonPath("$.username").value(TEST_ADMIN_USER));

        mockMvc.perform(get("/api/auth/demo-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));

        mockMvc.perform(post("/api/auth/demo-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("role", "ADMIN"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/demo/reset")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void rbacEnforcedAcrossAdminDoctorAndReceptionist() throws Exception {
        String adminToken = setupDemoWorkspaceAndGetAdminToken();
        String doctorToken = loginAndGetToken("doctor.demo", TEST_PASS);
        String receptionToken = loginAndGetToken("reception.demo", TEST_PASS);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "usernameOrEmail", "doctor.demo",
                                "password", "WrongPass#99"
                        ))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));

        mockMvc.perform(get("/api/users")
                        .header("Authorization", "Bearer " + doctorToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/users")
                        .header("Authorization", "Bearer " + receptionToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/medical-records")
                        .header("Authorization", "Bearer " + doctorToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/medical-records")
                        .header("Authorization", "Bearer " + receptionToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/patients/1")
                        .header("Authorization", "Bearer " + receptionToken))
                .andExpect(status().isForbidden());

        MvcResult newStaff = mockMvc.perform(post("/api/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Nurse Clara Reed",
                                "username", "desk.two",
                                "email", "desk2@curalithra.demo",
                                "password", TEST_PASS,
                                "role", "RECEPTIONIST"
                        ))))
                .andExpect(status().isCreated())
                .andReturn();
        long deskTwoId = objectMapper.readTree(newStaff.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/users/" + deskTwoId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "role", "RECEPTIONIST",
                                "active", false
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "usernameOrEmail", "desk.two",
                                "password", TEST_PASS
                        ))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer " + doctorToken))
                .andExpect(status().isNoContent());

        JsonNode meAfterLogin = objectMapper.readTree(mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + doctorToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertThat(meAfterLogin.get("role").asText()).isEqualTo("DOCTOR");
    }
}
