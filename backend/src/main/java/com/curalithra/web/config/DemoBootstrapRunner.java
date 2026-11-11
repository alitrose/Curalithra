package com.curalithra.web.config;

import com.curalithra.web.service.DemoService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Automatically ensures the isolated Public Demo dataset (`is_demo = true`) is ready
 * on startup when `curalithra.demo.enabled` and `curalithra.demo.seed-on-startup` are enabled.
 */
@Component
public class DemoBootstrapRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoBootstrapRunner.class);

    private final DemoService demoService;
    private final boolean demoEnabled;
    private final boolean seedOnStartup;

    public DemoBootstrapRunner(DemoService demoService,
                               @Value("${curalithra.demo.enabled:false}") boolean demoEnabled,
                               @Value("${curalithra.demo.seed-on-startup:true}") boolean seedOnStartup) {
        this.demoService = demoService;
        this.demoEnabled = demoEnabled;
        this.seedOnStartup = seedOnStartup;
    }

    @Override
    public void run(String... args) {
        if (!demoEnabled || !seedOnStartup) {
            return;
        }
        demoService.ensureDemoDatasetSeeded();
        log.info("Verified Public Demo workspace dataset (is_demo=true) for CURALITHRA Horizon Edition.");
    }
}
