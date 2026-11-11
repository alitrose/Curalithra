package com.curalithra.web.service;

import com.curalithra.web.dto.SettingsDtos;
import com.curalithra.web.entity.HospitalSettingsEntity;
import com.curalithra.web.entity.UserEntity;
import com.curalithra.web.enums.RolePermission;
import com.curalithra.web.exception.ValidationException;
import com.curalithra.web.repository.HospitalSettingsRepository;
import com.curalithra.web.security.PermissionService;
import com.curalithra.web.util.DomainValidators;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Locale;

@Service
public class SettingsService {

    private static final long SINGLETON_ID = 1L;

    private final HospitalSettingsRepository settingsRepository;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final BigDecimal fallbackTaxRate;
    private final String fallbackCurrencyCode;
    private final String fallbackCurrencySymbol;
    private final Clock clock;

    public SettingsService(HospitalSettingsRepository settingsRepository,
                           PermissionService permissionService,
                           AuditLogService auditLogService,
                           Clock clock,
                           @Value("${curalithra.app.default-tax-rate:0.0500}") BigDecimal fallbackTaxRate,
                           @Value("${curalithra.app.currency-code:INR}") String fallbackCurrencyCode,
                           @Value("${curalithra.app.currency-symbol:₹}") String fallbackCurrencySymbol) {
        this.settingsRepository = settingsRepository;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.fallbackTaxRate = fallbackTaxRate;
        this.fallbackCurrencyCode = fallbackCurrencyCode;
        this.fallbackCurrencySymbol = fallbackCurrencySymbol;
    }

    @Transactional(readOnly = true)
    public SettingsDtos.HospitalSettingsDto getSettings() {
        permissionService.requireAuthenticatedPrincipal();
        return toDto(loadOrCreateDefaultReadOnly());
    }

    @Transactional(readOnly = true)
    public BigDecimal resolveDefaultTaxRate() {
        return settingsRepository.findById(SINGLETON_ID)
                .map(HospitalSettingsEntity::getDefaultTaxRate)
                .orElse(fallbackTaxRate);
    }

    @Transactional(readOnly = true)
    public HospitalSettingsEntity getCurrentSettingsSnapshot() {
        return loadOrCreateDefaultReadOnly();
    }

    @Transactional
    public SettingsDtos.HospitalSettingsDto updateSettings(SettingsDtos.UpdateHospitalSettingsRequest req) {
        permissionService.requirePermission(RolePermission.MANAGE_SETTINGS);
        UserEntity actor = permissionService.requireCurrentUserEntity();

        HospitalSettingsEntity entity = settingsRepository.findById(SINGLETON_ID)
                .orElseGet(this::buildDefaultEntity);

        entity.setHospitalName(DomainValidators.requireNonBlank(req.hospitalName(), "Hospital name"));
        entity.setTagline(DomainValidators.requireNonBlank(req.tagline(), "Tagline"));
        if (req.defaultTaxRate().compareTo(BigDecimal.ZERO) < 0 || req.defaultTaxRate().compareTo(BigDecimal.ONE) > 0) {
            throw new ValidationException("Default tax rate must be between 0.0000 and 1.0000.");
        }
        entity.setDefaultTaxRate(req.defaultTaxRate().setScale(4, RoundingMode.HALF_UP));
        entity.setDefaultAppointmentMinutes(req.defaultAppointmentMinutes());
        entity.setCurrencyCode(DomainValidators.requireNonBlank(req.currencyCode(), "Currency code").toUpperCase(Locale.ROOT));
        entity.setCurrencySymbol(DomainValidators.requireNonBlank(req.currencySymbol(), "Currency symbol"));
        String cleanEmail = DomainValidators.validateEmail(req.supportEmail(), false);
        entity.setSupportEmail(cleanEmail.isEmpty() ? null : cleanEmail);
        String cleanPhone = DomainValidators.validatePhone(req.supportPhone(), false);
        entity.setSupportPhone(cleanPhone.isEmpty() ? null : cleanPhone);
        entity.setAddress(emptyToNull(DomainValidators.optionalTrimmed(req.address())));
        entity.setInvoiceFooterNote(emptyToNull(DomainValidators.optionalTrimmed(req.invoiceFooterNote())));
        entity.setUpdatedAt(OffsetDateTime.now(clock));

        HospitalSettingsEntity saved = settingsRepository.save(entity);
        auditLogService.record(actor, "UPDATE", "SETTINGS", "GLOBAL",
                "Updated hospital settings (taxRate=" + saved.getDefaultTaxRate()
                        + ", slotMinutes=" + saved.getDefaultAppointmentMinutes() + ")");
        return toDto(saved);
    }

    private HospitalSettingsEntity loadOrCreateDefaultReadOnly() {
        return settingsRepository.findById(SINGLETON_ID).orElseGet(this::buildDefaultEntity);
    }

    private HospitalSettingsEntity buildDefaultEntity() {
        HospitalSettingsEntity s = new HospitalSettingsEntity();
        s.setId(SINGLETON_ID);
        s.setHospitalName("CURALITHRA Medical Center");
        s.setTagline("Care, Connected. Operations, Simplified.");
        s.setDefaultTaxRate(fallbackTaxRate.setScale(4, RoundingMode.HALF_UP));
        s.setDefaultAppointmentMinutes(30);
        s.setCurrencyCode(fallbackCurrencyCode);
        s.setCurrencySymbol(fallbackCurrencySymbol);
        s.setSupportEmail("care@curalithra.demo");
        s.setSupportPhone("+91 800 555 0100");
        s.setAddress("Horizon Healthcare Campus, Sector 14");
        s.setInvoiceFooterNote("Thank you for trusting CURALITHRA Horizon Edition.");
        s.setUpdatedAt(OffsetDateTime.now(clock));
        return s;
    }

    private SettingsDtos.HospitalSettingsDto toDto(HospitalSettingsEntity s) {
        return new SettingsDtos.HospitalSettingsDto(
                s.getHospitalName(),
                s.getTagline(),
                s.getDefaultTaxRate(),
                s.getDefaultAppointmentMinutes(),
                s.getCurrencyCode(),
                s.getCurrencySymbol(),
                s.getSupportEmail(),
                s.getSupportPhone(),
                s.getAddress(),
                s.getInvoiceFooterNote(),
                s.getUpdatedAt()
        );
    }

    private String emptyToNull(String val) {
        return (val == null || val.isEmpty()) ? null : val;
    }
}
