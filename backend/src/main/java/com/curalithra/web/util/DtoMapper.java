package com.curalithra.web.util;

import com.curalithra.web.dto.*;
import com.curalithra.web.entity.*;
import com.curalithra.web.enums.RolePermission;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public final class DtoMapper {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private DtoMapper() {}

    public static AuthDtos.UserSummaryDto toUserSummary(UserEntity u) {
        Set<String> perms = RolePermission.permissionsFor(u.getRole())
                .stream()
                .map(Enum::name)
                .collect(Collectors.toSet());
        return new AuthDtos.UserSummaryDto(
                u.getId(),
                u.getUsername(),
                u.getFullName(),
                u.getEmail(),
                u.getRole(),
                u.getRole().getDisplayName(),
                u.getLinkedDoctorId(),
                u.isActive(),
                u.getCreatedAt(),
                u.getLastLoginAt(),
                perms
        );
    }

    public static PatientDtos.PatientDto toPatientDto(PatientEntity p) {
        return new PatientDtos.PatientDto(
                p.getId(),
                p.getPatientCode(),
                p.getFullName(),
                p.getDateOfBirth(),
                p.getGender(),
                p.getPhone(),
                p.getEmail(),
                p.getAddress(),
                p.getBloodGroup(),
                p.getEmergencyContact(),
                p.getBp(),
                p.getSugar(),
                p.getWeightKg(),
                p.getHeightCm(),
                p.getRegisteredAt()
        );
    }

    public static DoctorDtos.DepartmentDto toDepartmentDto(DepartmentEntity d) {
        return new DoctorDtos.DepartmentDto(d.getId(), d.getName(), d.getCode(), d.getDescription());
    }

    public static DoctorDtos.DoctorDto toDoctorDto(DoctorEntity d) {
        DepartmentEntity dept = d.getDepartment();
        return new DoctorDtos.DoctorDto(
                d.getId(),
                d.getDoctorCode(),
                d.getFullName(),
                d.getSpecialization(),
                dept != null ? dept.getId() : null,
                dept != null ? dept.getName() : "",
                d.getPhone(),
                d.getEmail(),
                d.getQualification(),
                d.getExperienceYears(),
                d.getAvailabilitySchedule(),
                d.getConsultationFee(),
                d.isActive(),
                d.getCreatedAt()
        );
    }

    public static AppointmentDtos.AppointmentDto toAppointmentDto(AppointmentEntity a) {
        return new AppointmentDtos.AppointmentDto(
                a.getId(),
                a.getAppointmentCode(),
                a.getPatient().getId(),
                a.getPatient().getPatientCode(),
                a.getPatient().getFullName(),
                a.getDoctor().getId(),
                a.getDoctor().getDoctorCode(),
                a.getDoctor().getFullName(),
                a.getDoctor().getSpecialization(),
                a.getAppointmentDate(),
                a.getAppointmentTime() != null ? a.getAppointmentTime().format(TIME_FMT) : "",
                a.getDurationMinutes(),
                a.getReason(),
                a.getStatus(),
                a.getStatus().getDisplayName(),
                a.getNotes(),
                a.getCreatedAt(),
                a.getUpdatedAt()
        );
    }

    public static MedicalRecordDtos.PrescriptionDto toPrescriptionDto(PrescriptionEntity rx) {
        return new MedicalRecordDtos.PrescriptionDto(
                rx.getId(),
                rx.getMedicalRecord().getId(),
                rx.getMedicalRecord().getRecordCode(),
                rx.getPatient().getId(),
                rx.getPatient().getFullName(),
                rx.getDoctor().getId(),
                rx.getDoctor().getFullName(),
                rx.getMedicationName(),
                rx.getDosage(),
                rx.getFrequency(),
                rx.getDurationDays(),
                rx.getInstructions(),
                rx.getStatus(),
                rx.getStatus().getDisplayName(),
                rx.getPrescribedAt()
        );
    }

    public static MedicalRecordDtos.MedicalRecordDto toMedicalRecordDto(MedicalRecordEntity m) {
        List<MedicalRecordDtos.PrescriptionDto> rxs = m.getPrescriptions() == null
                ? List.of()
                : m.getPrescriptions().stream().map(DtoMapper::toPrescriptionDto).toList();
        return new MedicalRecordDtos.MedicalRecordDto(
                m.getId(),
                m.getRecordCode(),
                m.getPatient().getId(),
                m.getPatient().getPatientCode(),
                m.getPatient().getFullName(),
                m.getDoctor().getId(),
                m.getDoctor().getDoctorCode(),
                m.getDoctor().getFullName(),
                m.getDoctor().getSpecialization(),
                m.getAppointment() != null ? m.getAppointment().getId() : null,
                m.getAppointment() != null ? m.getAppointment().getAppointmentCode() : null,
                m.getVisitDate(),
                m.getSymptoms(),
                m.getDiagnosis(),
                m.getTreatment(),
                m.getVitalsBp(),
                m.getVitalsTemp(),
                m.getNotes(),
                m.getCreatedAt(),
                rxs
        );
    }

    public static BillingDtos.BillItemDto toBillItemDto(BillItemEntity item) {
        return new BillingDtos.BillItemDto(
                item.getId(),
                item.getDescription(),
                item.getCategory(),
                item.getQuantity(),
                item.getUnitPrice(),
                item.getLineTotal()
        );
    }

    public static BillingDtos.PaymentDto toPaymentDto(PaymentEntity p) {
        return new BillingDtos.PaymentDto(
                p.getId(),
                p.getAmount(),
                p.getPaymentMethod(),
                p.getPaymentMethod().getDisplayName(),
                p.getReferenceNo(),
                p.getPaidAt(),
                p.getReceivedByUserId()
        );
    }

    public static BillingDtos.BillDto toBillDto(BillEntity b) {
        return new BillingDtos.BillDto(
                b.getId(),
                b.getInvoiceNumber(),
                b.getPatient().getId(),
                b.getPatient().getPatientCode(),
                b.getPatient().getFullName(),
                b.getAppointment() != null ? b.getAppointment().getId() : null,
                b.getAppointment() != null ? b.getAppointment().getAppointmentCode() : null,
                b.getSubtotal(),
                b.getTaxRate(),
                b.getTaxAmount(),
                b.getTotalAmount(),
                b.getPaidAmount(),
                b.getBalanceDue(),
                b.getPaymentStatus(),
                b.getPaymentStatus().getDisplayName(),
                b.getNotes(),
                b.getIssuedAt(),
                b.getUpdatedAt(),
                b.getItems().stream().map(DtoMapper::toBillItemDto).toList(),
                b.getPayments().stream().map(DtoMapper::toPaymentDto).toList()
        );
    }

    public static CommonDtos.ActivityLogDto toActivityLogDto(ActivityLogEntity l) {
        return new CommonDtos.ActivityLogDto(
                l.getId(),
                l.getUserId(),
                l.getUsername(),
                l.getActionType(),
                l.getEntityType(),
                l.getEntityId(),
                l.getSummary(),
                l.getCreatedAt()
        );
    }
}
