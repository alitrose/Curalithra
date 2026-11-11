package com.curalithra.web.config;

import com.curalithra.web.dto.AuthDtos;
import com.curalithra.web.service.AuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Optional environment-controlled bootstrap for non-interactive cloud deployments.
 * Never runs with hardcoded default credentials; activates only when explicitly
 * enabled and a non-blank CURALITHRA_BOOTSTRAP_ADMIN_PASSWORD is supplied on an empty DB.
 */
@Component
public class BootstrapRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(BootstrapRunner.class);

    private final AuthService authService;
    private final boolean enabled;
    private final String adminName;
    private final String adminUsername;
    private final String adminEmail;
    private final String adminPassword;
    private final boolean seedDemoData;

    public BootstrapRunner(AuthService authService,
                           @Value("${curalithra.bootstrap.enabled:false}") boolean enabled,
                           @Value("${curalithra.bootstrap.admin-name:Hospital Administrator}") String adminName,
                           @Value("${curalithra.bootstrap.admin-username:admin}") String adminUsername,
                           @Value("${curalithra.bootstrap.admin-email:admin@curalithra.demo}") String adminEmail,
                           @Value("${curalithra.bootstrap.admin-password:}") String adminPassword,
                           @Value("${curalithra.bootstrap.seed-demo-data:true}") boolean seedDemoData) {
        this.authService = authService;
        this.enabled = enabled;
        this.adminName = adminName;
        this.adminUsername = adminUsername;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
        this.seedDemoData = seedDemoData;
    }

    @Override
    public void run(String... args) {
        if (!enabled) {
            return;
        }
        if (adminPassword == null || adminPassword.trim().length() < 6) {
            log.warn("CURALITHRA_BOOTSTRAP_ENABLED is true, but CURALITHRA_BOOTSTRAP_ADMIN_PASSWORD is empty or < 6 chars. Skipping auto-bootstrap.");
            return;
        }
        if (!authService.isSetupRequired()) {
            return;
        }
        authService.setupInitialWorkspace(new AuthDtos.InitialSetupRequest(
                adminName, adminUsername, adminEmail, adminPassword, seedDemoData, false));
        log.info("Bootstrapped initial CURALITHRA administrator '{}' via environment configuration.", adminUsername);
    }
}
