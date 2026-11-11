package com.curalithra.web;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PatientAndDoctorIntegrationTest extends AbstractPostgresIntegrationTest {

    @Test
    void patientCrudPaginationDeduplicationAndFkProtection() throws Exception {
        String adminToken = setupDemoWorkspaceAndGetAdminToken();
        String receptionToken = loginAndGetToken("reception.demo", TEST_PASS);
        String doctorToken = loginAndGetToken("doctor.demo", TEST_PASS);

        mockMvc.perform(get("/api/patients?page=0&size=5")
                        .header("Authorization", "Bearer " + receptionToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(12))
                .andExpect(jsonPath("$.content.length()").value(5));

        Map<String, Object> newPatient = Map.ofEntries(
                Map.entry("fullName", "Avery Testpatient"),
                Map.entry("dateOfBirth", "1991-06-15"),
                Map.entry("gender", "Female"),
                Map.entry("phone", "+91 90999 88001"),
                Map.entry("email", "avery.test@example.org"),
                Map.entry("address", "100 Horizon Parkway"),
                Map.entry("bloodGroup", "A+"),
                Map.entry("emergencyContact", "Morgan Test (+91 90999 88002)"),
                Map.entry("bp", "118/76"),
                Map.entry("sugar", "95 mg/dL"),
                Map.entry("weightKg", "62.0"),
                Map.entry("heightCm", "168")
        );

        // Doctor cannot delete patients (403) or create doctors (403) per RolePermission matrix
        mockMvc.perform(delete("/api/patients/1")
                        .header("Authorization", "Bearer " + doctorToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/doctors")
                        .header("Authorization", "Bearer " + doctorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Dr. Unauthorized Test",
                                "specialization", "ENT",
                                "departmentId", 7,
                                "phone", "+91 98100 00001",
                                "email", "unauth.doc@curalithra.demo",
                                "qualification", "MS",
                                "experienceYears", 5,
                                "availabilitySchedule", "Mon-Fri",
                                "consultationFee", 500,
                                "active", true
                        ))))
                .andExpect(status().isForbidden());

        MvcResult createdRes = mockMvc.perform(post("/api/patients")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newPatient)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.patientCode").value("PAT-1013"))
                .andReturn();

        long createdId = objectMapper.readTree(createdRes.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(post("/api/patients")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newPatient)))
                .andExpect(status().isConflict());

        mockMvc.perform(put("/api/patients/" + createdId)
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.ofEntries(
                                Map.entry("fullName", "Avery Updatedpatient"),
                                Map.entry("dateOfBirth", "1991-06-15"),
                                Map.entry("gender", "Female"),
                                Map.entry("phone", "+91 90999 88001"),
                                Map.entry("email", "avery.updated@example.org"),
                                Map.entry("address", "102 Horizon Parkway"),
                                Map.entry("bloodGroup", "O+"),
                                Map.entry("emergencyContact", "Morgan Test"),
                                Map.entry("bp", "120/78")
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Avery Updatedpatient"))
                .andExpect(jsonPath("$.bloodGroup").value("O+"));

        mockMvc.perform(delete("/api/patients/" + createdId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        // Linked seeded patient #1 has appointments, medical records & bills -> FK rejects delete with 409 Conflict
        mockMvc.perform(delete("/api/patients/1")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
    }

    @Test
    void doctorCrudFilterAndSpecializationsWork() throws Exception {
        String adminToken = setupDemoWorkspaceAndGetAdminToken();

        mockMvc.perform(get("/api/doctors?specialization=Cardiology")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));

        JsonNode specs = objectMapper.readTree(mockMvc.perform(get("/api/doctors/specializations")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertThat(specs.size()).isGreaterThanOrEqualTo(6);

        MvcResult createdDoc = mockMvc.perform(post("/api/doctors")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.ofEntries(
                                Map.entry("fullName", "Dr. Julian West"),
                                Map.entry("specialization", "ENT"),
                                Map.entry("departmentId", 7),
                                Map.entry("phone", "+91 98100 99007"),
                                Map.entry("email", "j.west@curalithra.demo"),
                                Map.entry("qualification", "MS (ENT)"),
                                Map.entry("experienceYears", 10),
                                Map.entry("availabilitySchedule", "Mon-Fri 10:00-16:00"),
                                Map.entry("consultationFee", 700.00),
                                Map.entry("active", true)
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.doctorCode").value("DOC-1007"))
                .andReturn();

        long docId = objectMapper.readTree(createdDoc.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(get("/api/doctors/1/appointments")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").isNumber());

        mockMvc.perform(delete("/api/doctors/" + docId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        // Seeded Doctor 1 has linked appointments & medical records -> 409 Conflict
        mockMvc.perform(delete("/api/doctors/1")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
    }
}
