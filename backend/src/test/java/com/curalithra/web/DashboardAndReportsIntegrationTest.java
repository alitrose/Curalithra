package com.curalithra.web;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DashboardAndReportsIntegrationTest extends AbstractPostgresIntegrationTest {

    @Test
    void dashboardAnalyticsNotificationsAndAllReportsWithSafeCsvExport() throws Exception {
        String adminToken = setupDemoWorkspaceAndGetAdminToken();
        String receptionToken = loginAndGetToken("reception.demo", TEST_PASS);

        // Live dashboard KPIs and charts reflect seeded data
        mockMvc.perform(get("/api/dashboard/stats")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPatients").value(12))
                .andExpect(jsonPath("$.totalDoctors").value(6))
                .andExpect(jsonPath("$.statusDistribution.length()").value(5))
                .andExpect(jsonPath("$.patientRegistrationTrend").isArray())
                .andExpect(jsonPath("$.monthlyRevenueTrend").isArray())
                .andExpect(jsonPath("$.recentActivities").isNotEmpty());

        mockMvc.perform(get("/api/notifications")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isNotEmpty());

        for (String reportType : new String[]{"PATIENT_REGISTRATION", "DOCTOR_ACTIVITY", "APPOINTMENTS", "APPOINTMENT_STATUS", "REVENUE"}) {
            mockMvc.perform(get("/api/reports?type=" + reportType)
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.type").value(reportType))
                    .andExpect(jsonPath("$.headers").isNotEmpty());
        }

        // Verify CSV formula-injection neutralization
        mockMvc.perform(post("/api/patients")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "=CMD(\"calc\") Formula Test",
                                "dateOfBirth", "1995-01-01",
                                "gender", "Other",
                                "phone", "+91 90999 77001",
                                "bloodGroup", "Unknown"
                        ))))
                .andExpect(status().isCreated());

        MvcResult csvRes = mockMvc.perform(get("/api/reports/export?type=PATIENT_REGISTRATION&search=Formula")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "text/csv;charset=UTF-8"))
                .andReturn();

        String csvText = new String(csvRes.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
        assertThat(csvText).contains("\"'=CMD(\"\"calc\"\") Formula Test\"");

        // Audit log verification
        JsonNode logs = objectMapper.readTree(mockMvc.perform(get("/api/reports/audit-logs?page=0&size=20")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertThat(logs.get("totalElements").asLong()).isGreaterThanOrEqualTo(3);
    }
}
