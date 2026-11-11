package com.curalithra.web.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class TimeConfig {

    @Bean
    public Clock curalithraClock(@Value("${curalithra.app.timezone:UTC}") String timezone) {
        String clean = (timezone == null || timezone.trim().isEmpty()) ? "UTC" : timezone.trim();
        return Clock.system(ZoneId.of(clean));
    }
}
