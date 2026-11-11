package com.curalithra.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public final class PatientDtos {
    private PatientDtos() {}

    public record PatientDto(
            Long id,
            String patientCode,
            String fullName,
            LocalDate dateOfBirth,
            String gender,
            String phone,
            String email,
            String address,
            String bloodGroup,
            String emergencyContact,
            String bp,
            String sugar,
            String weightKg,
            String heightCm,
            OffsetDateTime registeredAt
    ) {}

    public record PatientRequest(
            @NotBlank(message = "Full name is required.")
            @Size(max = 150)
            String fullName,

            @NotNull(message = "Date of birth is required.")
            @PastOrPresent(message = "Date of birth cannot be in the future.")
            LocalDate dateOfBirth,

            @NotBlank(message = "Gender is required.")
            @Pattern(regexp = "^(Male|Female|Other)$", message = "Gender must be Male, Female, or Other.")
            String gender,

            @NotBlank(message = "Phone number is required.")
            @Size(min = 7, max = 30)
            String phone,

            @Email(message = "Please enter a valid email address.")
            String email,

            @Size(max = 500)
            String address,

            @Pattern(regexp = "^(A\\+|A-|B\\+|B-|AB\\+|AB-|O\\+|O-|Unknown)?$", message = "Invalid blood group.")
            String bloodGroup,

            @Size(max = 200)
            String emergencyContact,

            @Size(max = 40)
            String bp,

            @Size(max = 40)
            String sugar,

            @Size(max = 40)
            String weightKg,

            @Size(max = 40)
            String heightCm
    ) {}

    public record PatientHistoryDto(
            PatientDto patient,
            List<AppointmentDtos.AppointmentDto> appointments,
            List<MedicalRecordDtos.MedicalRecordDto> medicalRecords,
            boolean clinicalAccessGranted,
            List<BillingDtos.BillDto> bills
    ) {}
}
