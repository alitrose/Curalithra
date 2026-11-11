package com.curalithra.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class AbstractPostgresIntegrationTest {

    protected static final String TEST_ADMIN_USER = "sysadmin.test";
    protected static final String TEST_PASS = "Horizon#Test2026";

    private static final EmbeddedPostgres POSTGRES;

    static {
        try {
            POSTGRES = EmbeddedPostgres.builder().start();
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try {
                    POSTGRES.close();
                } catch (IOException ignored) {
                }
            }));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to start embedded PostgreSQL for integration tests", e);
        }
    }

    @DynamicPropertySource
    static void configureDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> POSTGRES.getJdbcUrl("postgres", "postgres"));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    @BeforeEach
    void resetDatabaseState() {
        jdbcTemplate.execute("""
                TRUNCATE TABLE notification_reads, activity_logs, payments, bill_items, bills,
                               prescriptions, medical_records, appointments,
                               patients, users, doctors, departments
                RESTART IDENTITY CASCADE
                """);
        jdbcTemplate.execute("ALTER SEQUENCE seq_patient_code RESTART WITH 1001");
        jdbcTemplate.execute("ALTER SEQUENCE seq_doctor_code RESTART WITH 1001");
        jdbcTemplate.execute("ALTER SEQUENCE seq_appointment_code RESTART WITH 2001");
        jdbcTemplate.execute("ALTER SEQUENCE seq_record_code RESTART WITH 3001");
        jdbcTemplate.execute("ALTER SEQUENCE seq_invoice_seq RESTART WITH 1");
        jdbcTemplate.execute("""
                INSERT INTO hospital_settings (
                    id, hospital_name, tagline, default_tax_rate, default_appointment_minutes,
                    currency_code, currency_symbol, support_email, support_phone, address, invoice_footer_note
                ) VALUES (
                    1, 'CURALITHRA Medical Center', 'Care, Connected. Operations, Simplified.',
                    0.0500, 30, 'INR', '₹', 'care@curalithra.demo', '+91 800 555 0100',
                    'Horizon Healthcare Campus, Sector 14',
                    'Thank you for trusting CURALITHRA Horizon Edition.'
                ) ON CONFLICT (id) DO UPDATE SET
                    hospital_name = EXCLUDED.hospital_name,
                    default_tax_rate = EXCLUDED.default_tax_rate,
                    default_appointment_minutes = EXCLUDED.default_appointment_minutes,
                    currency_code = EXCLUDED.currency_code,
                    currency_symbol = EXCLUDED.currency_symbol
                """);
    }

    protected String setupDemoWorkspaceAndGetAdminToken() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "fullName", "Dr. Jordan Mercer (Test Admin)",
                "username", TEST_ADMIN_USER,
                "email", "admin.test@curalithra.demo",
                "password", TEST_PASS,
                "seedDemoData", true,
                "createSampleRoleAccounts", true
        ));
        MvcResult result = mockMvc.perform(post("/api/auth/setup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.get("accessToken").asText();
    }

    protected String loginAndGetToken(String usernameOrEmail, String password) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "usernameOrEmail", usernameOrEmail,
                "password", password
        ));
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.get("accessToken").asText();
    }
}
