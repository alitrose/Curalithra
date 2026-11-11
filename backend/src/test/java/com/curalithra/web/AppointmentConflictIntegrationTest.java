package com.curalithra.web;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AppointmentConflictIntegrationTest extends AbstractPostgresIntegrationTest {

    @Test
    void detectsDoctorScheduleOverlapsAndFreesSlotWhenCancelled() throws Exception {
        setupDemoWorkspaceAndGetAdminToken();
        String receptionToken = loginAndGetToken("reception.demo", TEST_PASS);

        LocalDate targetDate = LocalDate.now(ZoneOffset.UTC).plusDays(10);

        // Past dates rejected with 400
        mockMvc.perform(post("/api/appointments")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", 1,
                                "doctorId", 1,
                                "appointmentDate", LocalDate.now(ZoneOffset.UTC).minusDays(2).toString(),
                                "appointmentTime", "10:00",
                                "durationMinutes", 30,
                                "reason", "Past check"
                        ))))
                .andExpect(status().isBadRequest());

        // Schedule 10:00 - 10:30 for Doctor 1
        MvcResult firstRes = mockMvc.perform(post("/api/appointments")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", 1,
                                "doctorId", 1,
                                "appointmentDate", targetDate.toString(),
                                "appointmentTime", "10:00",
                                "durationMinutes", 30,
                                "reason", "Initial consultation"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andReturn();

        long firstApptId = objectMapper.readTree(firstRes.getResponse().getContentAsString()).get("id").asLong();

        // Overlapping 10:15 - 10:45 for Doctor 1 rejected with 409 Conflict
        mockMvc.perform(post("/api/appointments")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", 2,
                                "doctorId", 1,
                                "appointmentDate", targetDate.toString(),
                                "appointmentTime", "10:15",
                                "durationMinutes", 30,
                                "reason", "Conflicting visit"
                        ))))
                .andExpect(status().isConflict());

        // Adjacent 10:30 - 11:00 succeeds cleanly
        mockMvc.perform(post("/api/appointments")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", 3,
                                "doctorId", 1,
                                "appointmentDate", targetDate.toString(),
                                "appointmentTime", "10:30",
                                "durationMinutes", 30,
                                "reason", "Adjacent slot"
                        ))))
                .andExpect(status().isCreated());

        // Cancel first appointment via DELETE -> status becomes CANCELLED
        mockMvc.perform(delete("/api/appointments/" + firstApptId)
                        .header("Authorization", "Bearer " + receptionToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        // Cancelled slot 10:00 is now free to book again
        mockMvc.perform(post("/api/appointments")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "patientId", 4,
                                "doctorId", 1,
                                "appointmentDate", targetDate.toString(),
                                "appointmentTime", "10:00",
                                "durationMinutes", 30,
                                "reason", "Rebooked cancelled slot"
                        ))))
                .andExpect(status().isCreated());

        // Reopening original cancelled appointment fails with 409 because slot is now rebooked
        mockMvc.perform(patch("/api/appointments/" + firstApptId + "/status")
                        .header("Authorization", "Bearer " + receptionToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "CONFIRMED"))))
                .andExpect(status().isConflict());

        // Calendar grouping endpoint returns day group
        mockMvc.perform(get("/api/appointments/calendar?doctorId=1&fromDate=" + targetDate + "&toDate=" + targetDate)
                        .header("Authorization", "Bearer " + receptionToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].date").value(targetDate.toString()))
                .andExpect(jsonPath("$[0].appointments.length()").value(3));
    }
}
