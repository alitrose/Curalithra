package com.curalithra.web;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MedicalRecordAndBillingIntegrationTest extends AbstractPostgresIntegrationTest {

    @Test
    void medicalRecordsAndPrescriptionsProtectedByRole() throws Exception {
        setupDemoWorkspaceAndGetAdminToken();
        String doctorToken = loginAndGetToken("doctor.demo", TEST_PASS);
        String receptionToken = loginAndGetToken("reception.demo", TEST_PASS);

        // Receptionist patient history strips clinical medical records
        mockMvc.perform(get("/api/patients/1/history")
                        .header("Authorization", "Bearer " + receptionToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clinicalAccessGranted").value(false))
                .andExpect(jsonPath("$.medicalRecords.length()").value(0));

        // Doctor patient history includes clinical medical records
        mockMvc.perform(get("/api/patients/1/history")
                        .header("Authorization", "Bearer " + doctorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clinicalAccessGranted").value(true))
                .andExpect(jsonPath("$.medicalRecords.length()").value(1));

        // Doctor creates clinical record + nested prescriptions atomically
        MvcResult recRes = mockMvc.perform(post("/api/medical-records")
                        .header("Authorization", "Bearer " + doctorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.ofEntries(
                                Map.entry("patientId", 2),
                                Map.entry("doctorId", 1),
                                Map.entry("visitDate", LocalDate.now(ZoneOffset.UTC).toString()),
                                Map.entry("symptoms", "Seasonal palpitations after caffeine"),
                                Map.entry("diagnosis", "Benign Sinus Tachycardia"),
                                Map.entry("treatment", "Hydration and electrolyte optimization"),
                                Map.entry("vitalsBp", "118/76"),
                                Map.entry("vitalsTemp", "98.4 F"),
                                Map.entry("prescriptions", List.of(Map.of(
                                        "medicationName", "Magnesium Glycinate",
                                        "dosage", "200 mg",
                                        "frequency", "Once nightly",
                                        "durationDays", 14,
                                        "instructions", "Take before sleep"
                                )))
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recordCode").value("REC-3005"))
                .andExpect(jsonPath("$.prescriptions.length()").value(1))
                .andReturn();

        JsonNode recJson = objectMapper.readTree(recRes.getResponse().getContentAsString());
        long rxId = recJson.get("prescriptions").get(0).get("id").asLong();

        mockMvc.perform(patch("/api/prescriptions/" + rxId + "/status")
                        .header("Authorization", "Bearer " + doctorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "DISPENSED"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DISPENSED"));
    }

    @Test
    void bigDecimalBillingLifecyclePaymentsCancelGuardAndPdfExport() throws Exception {
        setupDemoWorkspaceAndGetAdminToken();
        String receptionToken = loginAndGetToken("reception.demo", TEST_PASS);
        String doctorToken = loginAndGetToken("doctor.demo", TEST_PASS);

        mockMvc.perform(post("/api/billing")
                        .header("Authorization", "Bearer " + doctorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", 1,
                                "items", List.of(Map.of("description", "Consult", "category", "Consultation", "quantity", 1, "unitPrice", 500))
                        ))))
                .andExpect(status().isForbidden());

        // 2 * 500.00 + 1 * 250.50 = 1250.50 subtotal; 5% tax = 62.525 -> 62.53; total = 1313.03
        MvcResult billRes = mockMvc.perform(post("/api/billing")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.ofEntries(
                                Map.entry("patientId", 1),
                                Map.entry("items", List.of(
                                        Map.of("description", "Cardiology Follow-Up", "category", "Consultation", "quantity", 2, "unitPrice", 500.00),
                                        Map.of("description", "Troponin Blood Test", "category", "Laboratory", "quantity", 1, "unitPrice", 250.50)
                                )),
                                Map.entry("taxRate", 0.05),
                                Map.entry("initialPaymentAmount", 500.00),
                                Map.entry("paymentMethod", "UPI"),
                                Map.entry("referenceNo", "UPI-TEST-01"),
                                Map.entry("notes", "Partial initial payment")
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.subtotal").value(1250.50))
                .andExpect(jsonPath("$.taxAmount").value(62.53))
                .andExpect(jsonPath("$.totalAmount").value(1313.03))
                .andExpect(jsonPath("$.paidAmount").value(500.00))
                .andExpect(jsonPath("$.balanceDue").value(813.03))
                .andExpect(jsonPath("$.paymentStatus").value("PARTIALLY_PAID"))
                .andReturn();

        long billId = objectMapper.readTree(billRes.getResponse().getContentAsString()).get("id").asLong();

        // Cancelling invoice with recorded payments returns 400
        mockMvc.perform(post("/api/billing/" + billId + "/cancel")
                        .header("Authorization", "Bearer " + receptionToken))
                .andExpect(status().isBadRequest());

        // Overpayment returns 400
        mockMvc.perform(post("/api/billing/" + billId + "/payments")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "amount", 900.00,
                                "paymentMethod", "CARD"
                        ))))
                .andExpect(status().isBadRequest());

        // Exact remaining balance marks bill PAID
        mockMvc.perform(post("/api/billing/" + billId + "/payments")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "amount", 813.03,
                                "paymentMethod", "CARD",
                                "referenceNo", "CARD-TEST-02"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentStatus").value("PAID"))
                .andExpect(jsonPath("$.balanceDue").value(0));

        // Download generated OpenPDF invoice bytes and check %PDF- header
        MvcResult pdfRes = mockMvc.perform(get("/api/billing/" + billId + "/pdf")
                        .header("Authorization", "Bearer " + receptionToken))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andReturn();

        byte[] pdfBytes = pdfRes.getResponse().getContentAsByteArray();
        assertThat(pdfBytes.length).isGreaterThan(500);
        assertThat(new String(pdfBytes, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
    }
}
