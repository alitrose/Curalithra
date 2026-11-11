package com.curalithra.web.dto;

import com.curalithra.web.enums.PrescriptionStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public final class MedicalRecordDtos {
    private MedicalRecordDtos() {}

    public record PrescriptionDto(
            Long id,
            Long medicalRecordId,
            String recordCode,
            Long patientId,
            String patientName,
            Long doctorId,
            String doctorName,
            String medicationName,
            String dosage,
            String frequency,
            int durationDays,
            String instructions,
            PrescriptionStatus status,
            String statusDisplay,
            OffsetDateTime prescribedAt
    ) {}

    public record PrescriptionRequest(
            @NotBlank(message = "Medication name is required.")
            @Size(max = 200)
            String medicationName,

            @NotBlank(message = "Dosage is required.")
            @Size(max = 100)
            String dosage,

            @NotBlank(message = "Frequency is required.")
            @Size(max = 120)
            String frequency,

            @Min(value = 1, message = "Prescription duration must be at least 1 day.")
            int durationDays,

            @Size(max = 500)
            String instructions,

            PrescriptionStatus status
    ) {}

    public record PrescriptionStatusUpdateRequest(
            @NotNull(message = "Prescription status is required.")
            PrescriptionStatus status
    ) {}

    public record StandalonePrescriptionRequest(
            @NotNull(message = "Patient is required.")
            Long patientId,

            @NotNull(message = "Prescribing doctor is required.")
            Long doctorId,

            Long medicalRecordId,

            @NotBlank(message = "Medication name is required.")
            @Size(max = 200)
            String medicationName,

            @NotBlank(message = "Dosage is required.")
            @Size(max = 100)
            String dosage,

            @NotBlank(message = "Frequency is required.")
            @Size(max = 120)
            String frequency,

            @Min(value = 1, message = "Prescription duration must be at least 1 day.")
            int durationDays,

            @Size(max = 500)
            String instructions,

            PrescriptionStatus status,

            @Size(max = 500)
            String clinicalContext
    ) {}

    public record MedicalRecordDto(
            Long id,
            String recordCode,
            Long patientId,
            String patientCode,
            String patientName,
            Long doctorId,
            String doctorCode,
            String doctorName,
            String doctorSpecialization,
            Long appointmentId,
            String appointmentCode,
            LocalDate visitDate,
            String symptoms,
            String diagnosis,
            String treatment,
            String vitalsBp,
            String vitalsTemp,
            String notes,
            OffsetDateTime createdAt,
            List<PrescriptionDto> prescriptions
    ) {}

    public record MedicalRecordRequest(
            @NotNull(message = "Patient is required.")
            Long patientId,

            @NotNull(message = "Attending doctor is required.")
            Long doctorId,

            Long appointmentId,

            @NotNull(message = "Visit date is required.")
            LocalDate visitDate,

            @NotBlank(message = "Symptoms are required.")
            String symptoms,

            @NotBlank(message = "Diagnosis is required.")
            String diagnosis,

            @NotBlank(message = "Treatment plan is required.")
            String treatment,

            @Size(max = 40)
            String vitalsBp,

            @Size(max = 40)
            String vitalsTemp,

            String notes,

            @Valid
            List<PrescriptionRequest> prescriptions
    ) {}
}
