package com.curalithra.web.controller;

import com.curalithra.web.dto.SettingsDtos;
import com.curalithra.web.service.SettingsService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public SettingsDtos.HospitalSettingsDto getSettings() {
        return settingsService.getSettings();
    }

    @PutMapping
    public SettingsDtos.HospitalSettingsDto updateSettings(
            @Valid @RequestBody SettingsDtos.UpdateHospitalSettingsRequest req) {
        return settingsService.updateSettings(req);
    }
}
