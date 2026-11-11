package com.curalithra.web.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public final class SettingsDtos {
    private SettingsDtos() {}

    public record HospitalSettingsDto(
            String hospitalName,
            String tagline,
            BigDecimal defaultTaxRate,
            int defaultAppointmentMinutes,
            String currencyCode,
            String currencySymbol,
            String supportEmail,
            String supportPhone,
            String address,
            String invoiceFooterNote,
            OffsetDateTime updatedAt
    ) {}

    public record UpdateHospitalSettingsRequest(
            @NotBlank(message = "Hospital name is required.")
            @Size(max = 160)
            String hospitalName,

            @NotBlank(message = "Tagline is required.")
            @Size(max = 240)
            String tagline,

            @NotNull(message = "Default tax rate is required.")
            @DecimalMin(value = "0.0000", message = "Tax rate cannot be negative.")
            @DecimalMax(value = "1.0000", message = "Tax rate must be expressed as a decimal (e.g., 0.05 for 5%).")
            BigDecimal defaultTaxRate,

            @Min(value = 5, message = "Default appointment duration must be at least 5 minutes.")
            @Max(value = 480, message = "Default appointment duration cannot exceed 480 minutes.")
            int defaultAppointmentMinutes,

            @NotBlank(message = "Currency code is required.")
            @Size(max = 10)
            String currencyCode,

            @NotBlank(message = "Currency symbol is required.")
            @Size(max = 8)
            String currencySymbol,

            @Email(message = "Please enter a valid support email address.")
            @Size(max = 160)
            String supportEmail,

            @Size(max = 40)
            String supportPhone,

            @Size(max = 400)
            String address,

            @Size(max = 400)
            String invoiceFooterNote
    ) {}
}
