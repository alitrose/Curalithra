package com.curalithra.web;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SettingsNotificationsAndPrescriptionsIntegrationTest extends AbstractPostgresIntegrationTest {

    @Test
    void notificationsReadAndMarkAllReadPersistPerUser() throws Exception {
        String adminToken = setupDemoWorkspaceAndGetAdminToken();
        String doctorToken = loginAndGetToken("doctor.demo", TEST_PASS);

        MvcResult initialRes = mockMvc.perform(get("/api/notifications")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").isNumber())
                .andExpect(jsonPath("$.items").isNotEmpty())
                .andReturn();

        JsonNode initialJson = objectMapper.readTree(initialRes.getResponse().getContentAsString());
        int initialUnread = initialJson.get("unreadCount").asInt();
        String firstKey = initialJson.get("items").get(0).get("id").asText();
        assertThat(initialUnread).isGreaterThan(0);

        mockMvc.perform(post("/api/notifications/" + firstKey + "/read")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(initialUnread - 1));

        // Doctor's unread notifications are isolated per user
        mockMvc.perform(get("/api/notifications")
                        .header("Authorization", "Bearer " + doctorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].read").value(false));

        mockMvc.perform(post("/api/notifications/mark-all-read")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));
    }

    @Test
    void hospitalSettingsRequireAdminAndDriveBillingDefaultTaxRate() throws Exception {
        String adminToken = setupDemoWorkspaceAndGetAdminToken();
        String receptionToken = loginAndGetToken("reception.demo", TEST_PASS);

        mockMvc.perform(get("/api/settings")
                        .header("Authorization", "Bearer " + receptionToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hospitalName").value("CURALITHRA Medical Center"));

        mockMvc.perform(put("/api/settings")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.ofEntries(
                                Map.entry("hospitalName", "Unauthorized Change"),
                                Map.entry("tagline", "Test"),
                                Map.entry("defaultTaxRate", 0.10),
                                Map.entry("defaultAppointmentMinutes", 30),
                                Map.entry("currencyCode", "INR"),
                                Map.entry("currencySymbol", "₹")
                        ))))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.ofEntries(
                                Map.entry("hospitalName", "CURALITHRA Horizon Hospital"),
                                Map.entry("tagline", "Care, Connected. Operations, Simplified."),
                                Map.entry("defaultTaxRate", 0.1200),
                                Map.entry("defaultAppointmentMinutes", 45),
                                Map.entry("currencyCode", "INR"),
                                Map.entry("currencySymbol", "₹"),
                                Map.entry("supportEmail", "desk@curalithra.demo"),
                                Map.entry("supportPhone", "+91 800 555 0199"),
                                Map.entry("address", "Sector 14 Medical Campus"),
                                Map.entry("invoiceFooterNote", "Updated footer note")
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.defaultTaxRate").value(0.12))
                .andExpect(jsonPath("$.defaultAppointmentMinutes").value(45));

        // Creating a bill without explicit taxRate should now apply 12%
        mockMvc.perform(post("/api/billing")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", 1,
                                "items", List.of(Map.of(
                                        "description", "Specialist Review",
                                        "category", "Consultation",
                                        "quantity", 1,
                                        "unitPrice", 1000.00
                                ))
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.taxRate").value(0.12))
                .andExpect(jsonPath("$.taxAmount").value(120.00))
                .andExpect(jsonPath("$.totalAmount").value(1120.00));

        // Update configured hospital currency to USD / $ and confirm notifications & revenue reports reflect it dynamically
        mockMvc.perform(put("/api/settings")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.ofEntries(
                                Map.entry("hospitalName", "CURALITHRA Horizon Hospital"),
                                Map.entry("tagline", "Care, Connected. Operations, Simplified."),
                                Map.entry("defaultTaxRate", 0.1200),
                                Map.entry("defaultAppointmentMinutes", 45),
                                Map.entry("currencyCode", "USD"),
                                Map.entry("currencySymbol", "$"),
                                Map.entry("supportEmail", "desk@curalithra.demo"),
                                Map.entry("supportPhone", "+91 800 555 0199"),
                                Map.entry("address", "Sector 14 Medical Campus"),
                                Map.entry("invoiceFooterNote", "Updated footer note")
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currencyCode").value("USD"))
                .andExpect(jsonPath("$.currencySymbol").value("$"));

        String notificationsBody = mockMvc.perform(get("/api/notifications")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(notificationsBody).contains("$").doesNotContain("₹");

        String revenueReportBody = mockMvc.perform(get("/api/reports?type=REVENUE")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(revenueReportBody).contains("$").doesNotContain("₹");
    }

    @Test
    void standalonePrescriptionDashboardDateFiltersAndProfileUpdateWork() throws Exception {
        setupDemoWorkspaceAndGetAdminToken();
        String doctorToken = loginAndGetToken("doctor.demo", TEST_PASS);
        String receptionToken = loginAndGetToken("reception.demo", TEST_PASS);

        // Receptionist cannot create prescriptions
        mockMvc.perform(post("/api/prescriptions")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", 1,
                                "doctorId", 1,
                                "medicationName", "Atorvastatin",
                                "dosage", "10 mg",
                                "frequency", "Once nightly",
                                "durationDays", 30
                        ))))
                .andExpect(status().isForbidden());

        // Doctor creates standalone prescription (auto-links clinical consultation record)
        mockMvc.perform(post("/api/prescriptions")
                        .header("Authorization", "Bearer " + doctorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.ofEntries(
                                Map.entry("patientId", 1),
                                Map.entry("doctorId", 1),
                                Map.entry("medicationName", "Atorvastatin"),
                                Map.entry("dosage", "10 mg"),
                                Map.entry("frequency", "Once nightly"),
                                Map.entry("durationDays", 30),
                                Map.entry("instructions", "Take after dinner"),
                                Map.entry("clinicalContext", "Lipid optimization follow-up")
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.medicationName").value("Atorvastatin"))
                .andExpect(jsonPath("$.recordCode").value("REC-3005"));

        // Filter prescriptions by query
        mockMvc.perform(get("/api/prescriptions?query=Atorvastatin&status=ACTIVE")
                        .header("Authorization", "Bearer " + doctorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));

        // Get single appointment
        mockMvc.perform(get("/api/appointments/1")
                        .header("Authorization", "Bearer " + doctorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appointmentCode").isNotEmpty());

        // Dashboard date-range filter and cancelled count
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        mockMvc.perform(get("/api/dashboard/stats?fromDate=" + today.minusDays(7) + "&toDate=" + today.plusDays(7))
                        .header("Authorization", "Bearer " + doctorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cancelledAppointments").isNumber())
                .andExpect(jsonPath("$.statusDistribution.length()").value(5));

        // Profile self-update
        mockMvc.perform(put("/api/auth/me")
                        .header("Authorization", "Bearer " + doctorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Dr. Evelyn Hayes MD",
                                "email", "e.hayes@curalithra.demo"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Dr. Evelyn Hayes MD"));
    }
}
