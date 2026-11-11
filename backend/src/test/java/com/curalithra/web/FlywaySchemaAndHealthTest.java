package com.curalithra.web;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class FlywaySchemaAndHealthTest extends AbstractPostgresIntegrationTest {

    @Test
    void flywayV1MigrationAppliedAndSchemaObjectsExist() {
        Integer appliedMigrations = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version IN ('1', '2') AND success = TRUE",
                Integer.class);
        assertThat(appliedMigrations).isEqualTo(2);

        List<String> tables = jdbcTemplate.queryForList(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
                String.class);
        assertThat(tables).contains(
                "departments", "doctors", "users", "patients",
                "appointments", "medical_records", "prescriptions",
                "bills", "bill_items", "payments", "activity_logs",
                "notification_reads", "hospital_settings");

        Integer uniqueSlotIndex = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'appointments' AND indexname = 'idx_appointments_doctor_slot'",
                Integer.class);
        assertThat(uniqueSlotIndex).isEqualTo(1);
    }

    @Test
    void healthEndpointAndSetupStatusWorkOnFreshDatabase() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.database").value("CONNECTED"))
                .andExpect(jsonPath("$.service").value("CURALITHRA Web API"));

        mockMvc.perform(get("/api/auth/setup-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.setupRequired").value(true));
    }
}
