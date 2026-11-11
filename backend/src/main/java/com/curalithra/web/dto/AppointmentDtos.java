package com.curalithra.web.dto;

import com.curalithra.web.enums.AppointmentStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public final class AppointmentDtos {
    private AppointmentDtos() {}

    public record AppointmentDto(
            Long id,
            String appointmentCode,
            Long patientId,
            String patientCode,
            String patientName,
            Long doctorId,
            String doctorCode,
            String doctorName,
            String doctorSpecialization,
            LocalDate appointmentDate,
            String appointmentTime,
            int durationMinutes,
            String reason,
            AppointmentStatus status,
            String statusDisplay,
            String notes,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {}

    public record AppointmentRequest(
            @NotNull(message = "Patient is required.")
            Long patientId,

            @NotNull(message = "Doctor is required.")
            Long doctorId,

            @NotNull(message = "Appointment date is required.")
            LocalDate appointmentDate,

            @NotBlank(message = "Appointment time is required.")
            @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "Time must be in 24-hour HH:mm format.")
            String appointmentTime,

            @Min(value = 5, message = "Duration must be at least 5 minutes.")
            @Max(value = 480, message = "Duration cannot exceed 480 minutes.")
            int durationMinutes,

            @NotBlank(message = "Reason for visit is required.")
            @Size(max = 500)
            String reason,

            AppointmentStatus status,

            @Size(max = 2000)
            String notes
    ) {}

    public record AppointmentStatusUpdateRequest(
            @NotNull(message = "Status is required.")
            AppointmentStatus status
    ) {}

    public record CalendarDayGroupDto(
            LocalDate date,
            List<AppointmentDto> appointments
    ) {}
}
