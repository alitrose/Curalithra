package com.curalithra.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public final class DoctorDtos {
    private DoctorDtos() {}

    public record DepartmentDto(
            Long id,
            String name,
            String code,
            String description
    ) {}

    public record DoctorDto(
            Long id,
            String doctorCode,
            String fullName,
            String specialization,
            Long departmentId,
            String departmentName,
            String phone,
            String email,
            String qualification,
            int experienceYears,
            String availabilitySchedule,
            BigDecimal consultationFee,
            boolean active,
            OffsetDateTime createdAt
    ) {}

    public record DoctorRequest(
            @NotBlank(message = "Doctor full name is required.")
            @Size(max = 150)
            String fullName,

            @NotBlank(message = "Specialization is required.")
            @Size(max = 120)
            String specialization,

            @NotNull(message = "Department is required.")
            Long departmentId,

            @NotBlank(message = "Phone number is required.")
            @Size(min = 7, max = 30)
            String phone,

            @NotBlank(message = "Email address is required.")
            @Email(message = "Please enter a valid email address.")
            String email,

            @NotBlank(message = "Qualification is required.")
            @Size(max = 200)
            String qualification,

            @Min(value = 0, message = "Experience years must be at least 0.")
            @Max(value = 75, message = "Experience years cannot exceed 75.")
            int experienceYears,

            @NotBlank(message = "Availability schedule is required.")
            @Size(max = 200)
            String availabilitySchedule,

            @NotNull(message = "Consultation fee is required.")
            @DecimalMin(value = "0.00", message = "Consultation fee cannot be negative.")
            BigDecimal consultationFee,

            boolean active
    ) {}
}
