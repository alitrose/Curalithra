package com.curalithra.web.controller;

import com.curalithra.web.dto.CommonDtos;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final JdbcTemplate jdbcTemplate;
    private final String version;

    public HealthController(JdbcTemplate jdbcTemplate,
                            @Value("${curalithra.app.version:1.0.0}") String version) {
        this.jdbcTemplate = jdbcTemplate;
        this.version = version;
    }

    @GetMapping
    public ResponseEntity<CommonDtos.HealthStatusResponse> health() {
        try {
            Integer res = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            boolean ok = res != null && res == 1;
            return ResponseEntity.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new CommonDtos.HealthStatusResponse(
                            ok ? "UP" : "DOWN",
                            "CURALITHRA Web API",
                            version,
                            ok ? "CONNECTED" : "DISCONNECTED",
                            Instant.now().toString()
                    ));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new CommonDtos.HealthStatusResponse(
                            "DOWN",
                            "CURALITHRA Web API",
                            version,
                            "DISCONNECTED",
                            Instant.now().toString()
                    ));
        }
    }
}
