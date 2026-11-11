package com.curalithra.web.controller;

import com.curalithra.web.dto.AuthDtos;
import com.curalithra.web.service.DemoService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class DemoController {

    private final DemoService demoService;

    public DemoController(DemoService demoService) {
        this.demoService = demoService;
    }

    @GetMapping("/auth/demo-status")
    public AuthDtos.DemoStatusResponse demoStatus() {
        return demoService.getDemoStatus();
    }

    @PostMapping("/auth/demo-login")
    public AuthDtos.AuthResponse demoLogin(@Valid @RequestBody AuthDtos.DemoLoginRequest req) {
        return demoService.loginDemoRole(req.role());
    }

    @PostMapping("/demo/reset")
    public AuthDtos.DemoResetResponse resetDemo() {
        return demoService.resetDemoDataset();
    }
}
