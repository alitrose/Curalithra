package com.curalithra.web.service;

import com.curalithra.web.dto.AppointmentDtos;
import com.curalithra.web.dto.CommonDtos;
import com.curalithra.web.entity.AppointmentEntity;
import com.curalithra.web.entity.DoctorEntity;
import com.curalithra.web.entity.PatientEntity;
import com.curalithra.web.entity.UserEntity;
import com.curalithra.web.enums.AppointmentStatus;
import com.curalithra.web.enums.RolePermission;
import com.curalithra.web.exception.ConflictException;
import com.curalithra.web.exception.NotFoundException;
import com.curalithra.web.exception.ValidationException;
import com.curalithra.web.repository.AppointmentRepository;
import com.curalithra.web.repository.DoctorRepository;
import com.curalithra.web.repository.PatientRepository;
import com.curalithra.web.repository.SequenceRepository;
import com.curalithra.web.security.PermissionService;
import com.curalithra.web.util.DomainValidators;
import com.curalithra.web.util.DtoMapper;
import com.curalithra.web.util.PaginationUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AppointmentService {

    private static final LocalDate MIN_DATE = LocalDate.of(1900, 1, 1);
    private static final LocalDate MAX_DATE = LocalDate.of(2999, 12, 31);
    private static final Map<String, String> ALLOWED_SORTS = Map.of(
            "appointmentDate", "appointmentDate",
            "appointmentTime", "appointmentTime",
            "appointmentCode", "appointmentCode",
            "status", "status",
            "createdAt", "createdAt"
    );

    private final AppointmentRepository appointmentRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final SequenceRepository sequenceRepository;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public AppointmentService(AppointmentRepository appointmentRepository,
                              PatientRepository patientRepository,
                              DoctorRepository doctorRepository,
                              SequenceRepository sequenceRepository,
                              PermissionService permissionService,
                              AuditLogService auditLogService,
                              Clock clock) {
        this.appointmentRepository = appointmentRepository;
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.sequenceRepository = sequenceRepository;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CommonDtos.PagedResponse<AppointmentDtos.AppointmentDto> searchAppointments(
            String query, AppointmentStatus status, Long doctorId, Long patientId,
            LocalDate fromDate, LocalDate toDate, int page, int size, String sortBy, String sortDir) {
        permissionService.requirePermission(RolePermission.VIEW_APPOINTMENTS);
        String cleanQuery = DomainValidators.optionalTrimmed(query);
        LocalDate effectiveFrom = fromDate != null ? fromDate : MIN_DATE;
        LocalDate effectiveTo = toDate != null ? toDate : MAX_DATE;
        boolean demoScope = permissionService.isCurrentDemoUser();
        Pageable pageable = PaginationUtils.createPageable(page, size, sortBy, sortDir, ALLOWED_SORTS, "appointmentDate");

        Page<AppointmentEntity> result = appointmentRepository.searchAndFilter(
                cleanQuery,
                status != null,
                status != null ? status : AppointmentStatus.SCHEDULED,
                doctorId != null ? doctorId : 0L,
                patientId != null ? patientId : 0L,
                effectiveFrom,
                effectiveTo,
                demoScope,
                pageable);
        return PaginationUtils.toPagedResponse(result, DtoMapper::toAppointmentDto);
    }

    @Transactional(readOnly = true)
    public List<AppointmentDtos.CalendarDayGroupDto> getCalendarView(
            String query, AppointmentStatus status, Long doctorId, LocalDate fromDate, LocalDate toDate) {
        permissionService.requirePermission(RolePermission.VIEW_APPOINTMENTS);
        boolean demoScope = permissionService.isCurrentDemoUser();
        String cleanQuery = DomainValidators.optionalTrimmed(query);
        LocalDate effectiveToday = LocalDate.now(clock);
        LocalDate effectiveFrom = fromDate != null ? fromDate : effectiveToday.minusDays(14);
        LocalDate effectiveTo = toDate != null ? toDate : effectiveToday.plusDays(45);
        Pageable pageable = PaginationUtils.createPageable(0, 100, "appointmentDate", "asc", ALLOWED_SORTS, "appointmentDate");

        Page<AppointmentEntity> result = appointmentRepository.searchAndFilter(
                cleanQuery,
                status != null,
                status != null ? status : AppointmentStatus.SCHEDULED,
                doctorId != null ? doctorId : 0L,
                0L,
                effectiveFrom,
                effectiveTo,
                demoScope,
                pageable);

        Map<LocalDate, List<AppointmentDtos.AppointmentDto>> grouped = new LinkedHashMap<>();
        result.getContent().stream()
                .sorted((a, b) -> {
                    int dateCmp = a.getAppointmentDate().compareTo(b.getAppointmentDate());
                    return dateCmp != 0 ? dateCmp : a.getAppointmentTime().compareTo(b.getAppointmentTime());
                })
                .forEach(a -> grouped.computeIfAbsent(a.getAppointmentDate(), k -> new java.util.ArrayList<>())
                        .add(DtoMapper.toAppointmentDto(a)));

        return grouped.entrySet().stream()
                .map(e -> new AppointmentDtos.CalendarDayGroupDto(e.getKey(), e.getValue()))
                .toList();
    }

    @Transactional(readOnly = true)
    public AppointmentDtos.AppointmentDto getAppointment(long id) {
        permissionService.requirePermission(RolePermission.VIEW_APPOINTMENTS);
        AppointmentEntity appt = appointmentRepository.findHydratedById(id)
                .orElseThrow(() -> new NotFoundException("Appointment not found."));
        permissionService.verifySameScope(appt.isDemoRecord(), "Appointment");
        return DtoMapper.toAppointmentDto(appt);
    }

    @Transactional
    public AppointmentDtos.AppointmentDto scheduleAppointment(AppointmentDtos.AppointmentRequest req) {
        permissionService.requirePermission(RolePermission.MANAGE_APPOINTMENTS);
        permissionService.forbidDemoMutation("Scheduling appointments");
        UserEntity actor = permissionService.requireCurrentUserEntity();

        PatientEntity patient = patientRepository.findById(req.patientId())
                .orElseThrow(() -> new NotFoundException("Selected patient does not exist."));
        permissionService.verifySameScope(patient.isDemoRecord(), "Selected patient");
        DoctorEntity doctor = doctorRepository.findWithDepartmentById(req.doctorId())
                .orElseThrow(() -> new NotFoundException("Selected doctor does not exist."));
        permissionService.verifySameScope(doctor.isDemoRecord(), "Selected doctor");
        if (!doctor.isActive()) {
            throw new ValidationException("Cannot schedule with an inactive doctor (" + doctor.getFullName() + ").");
        }

        LocalDate date = req.appointmentDate();
        LocalTime time = DomainValidators.validateTime24h(req.appointmentTime(), "Appointment time");
        LocalDate today = LocalDate.now(clock);
        if (date.isBefore(today)) {
            throw new ValidationException("Appointment date cannot be in the past.");
        }
        if (date.equals(today) && time.isBefore(LocalTime.now(clock).minusMinutes(5))) {
            throw new ValidationException("Cannot book a time slot earlier than the current time.");
        }

        AppointmentStatus status = req.status() == null ? AppointmentStatus.SCHEDULED : req.status();
        if (status.blocksScheduleSlot() && hasDoctorTimeOverlap(doctor.getId(), date, time, req.durationMinutes(), null)) {
            throw new ConflictException("Schedule conflict: " + doctor.getFullName()
                    + " already has an overlapping appointment on " + date + " at " + time + ".");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        AppointmentEntity entity = new AppointmentEntity();
        entity.setAppointmentCode("APT-" + sequenceRepository.nextAppointmentNumber());
        entity.setDemoRecord(actor.isDemoUser());
        entity.setPatient(patient);
        entity.setDoctor(doctor);
        entity.setAppointmentDate(date);
        entity.setAppointmentTime(time);
        entity.setDurationMinutes(req.durationMinutes());
        entity.setReason(DomainValidators.requireNonBlank(req.reason(), "Reason for visit"));
        entity.setStatus(status);
        entity.setNotes(DomainValidators.optionalTrimmed(req.notes()));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        AppointmentEntity saved = appointmentRepository.save(entity);
        auditLogService.record(actor, "CREATE", "APPOINTMENT", saved.getAppointmentCode(),
                "Scheduled " + patient.getFullName() + " with " + doctor.getFullName() + " on " + date + " " + time);
        return DtoMapper.toAppointmentDto(saved);
    }

    @Transactional
    public AppointmentDtos.AppointmentDto updateAppointment(long id, AppointmentDtos.AppointmentRequest req) {
        permissionService.requirePermission(RolePermission.MANAGE_APPOINTMENTS);
        permissionService.forbidDemoMutation("Updating appointments");
        UserEntity actor = permissionService.requireCurrentUserEntity();

        AppointmentEntity existing = appointmentRepository.findHydratedById(id)
                .orElseThrow(() -> new NotFoundException("Appointment not found."));
        permissionService.verifySameScope(existing.isDemoRecord(), "Appointment");
        PatientEntity patient = patientRepository.findById(req.patientId())
                .orElseThrow(() -> new NotFoundException("Selected patient does not exist."));
        permissionService.verifySameScope(patient.isDemoRecord(), "Selected patient");
        DoctorEntity doctor = doctorRepository.findWithDepartmentById(req.doctorId())
                .orElseThrow(() -> new NotFoundException("Selected doctor does not exist."));
        permissionService.verifySameScope(doctor.isDemoRecord(), "Selected doctor");
        if (!doctor.isActive() && !doctor.getId().equals(existing.getDoctor().getId())) {
            throw new ValidationException("Cannot assign appointment to an inactive doctor (" + doctor.getFullName() + ").");
        }

        LocalDate date = req.appointmentDate();
        LocalTime time = DomainValidators.validateTime24h(req.appointmentTime(), "Appointment time");
        AppointmentStatus nextStatus = req.status() == null ? existing.getStatus() : req.status();
        if (nextStatus == AppointmentStatus.CANCELLED) {
            permissionService.requirePermission(RolePermission.CANCEL_APPOINTMENTS);
        }

        if (nextStatus.blocksScheduleSlot() && hasDoctorTimeOverlap(doctor.getId(), date, time, req.durationMinutes(), id)) {
            throw new ConflictException("Schedule conflict: " + doctor.getFullName()
                    + " already has another appointment overlapping " + date + " at " + time + ".");
        }

        existing.setPatient(patient);
        existing.setDoctor(doctor);
        existing.setAppointmentDate(date);
        existing.setAppointmentTime(time);
        existing.setDurationMinutes(req.durationMinutes());
        existing.setReason(DomainValidators.requireNonBlank(req.reason(), "Reason for visit"));
        existing.setStatus(nextStatus);
        existing.setNotes(DomainValidators.optionalTrimmed(req.notes()));
        existing.setUpdatedAt(OffsetDateTime.now(clock));

        AppointmentEntity saved = appointmentRepository.save(existing);
        auditLogService.record(actor, "UPDATE", "APPOINTMENT", saved.getAppointmentCode(),
                "Updated appointment (" + saved.getStatus().getDisplayName() + ")");
        return DtoMapper.toAppointmentDto(saved);
    }

    @Transactional
    public AppointmentDtos.AppointmentDto updateStatus(long id, AppointmentStatus newStatus) {
        if (newStatus == AppointmentStatus.CANCELLED) {
            permissionService.requirePermission(RolePermission.CANCEL_APPOINTMENTS);
        } else {
            permissionService.requirePermission(RolePermission.MANAGE_APPOINTMENTS);
        }
        permissionService.forbidDemoMutation("Updating appointment status");
        UserEntity actor = permissionService.requireCurrentUserEntity();

        AppointmentEntity existing = appointmentRepository.findHydratedById(id)
                .orElseThrow(() -> new NotFoundException("Appointment not found."));
        permissionService.verifySameScope(existing.isDemoRecord(), "Appointment");

        if (newStatus.blocksScheduleSlot() && !existing.getStatus().blocksScheduleSlot()) {
            if (hasDoctorTimeOverlap(existing.getDoctor().getId(), existing.getAppointmentDate(),
                    existing.getAppointmentTime(), existing.getDurationMinutes(), existing.getId())) {
                throw new ConflictException(
                        "Cannot reopen appointment: the doctor's time slot is now occupied by another visit.");
            }
        }

        existing.setStatus(newStatus);
        existing.setUpdatedAt(OffsetDateTime.now(clock));
        AppointmentEntity saved = appointmentRepository.save(existing);

        auditLogService.record(actor, "STATUS", "APPOINTMENT", saved.getAppointmentCode(),
                "Changed status to " + newStatus.getDisplayName());
        return DtoMapper.toAppointmentDto(saved);
    }

    @Transactional
    public AppointmentDtos.AppointmentDto cancelAppointment(long id) {
        return updateStatus(id, AppointmentStatus.CANCELLED);
    }

    private boolean hasDoctorTimeOverlap(long doctorId, LocalDate date, LocalTime startTime, int durationMinutes, Long excludeId) {
        int newStartMin = startTime.getHour() * 60 + startTime.getMinute();
        int newEndMin = newStartMin + Math.max(1, durationMinutes);

        List<AppointmentEntity> sameDay = appointmentRepository.findByDoctorIdAndAppointmentDateOrderByAppointmentTimeAsc(doctorId, date);
        for (AppointmentEntity other : sameDay) {
            if (excludeId != null && other.getId().equals(excludeId)) continue;
            if (!other.getStatus().blocksScheduleSlot()) continue;

            int otherStart = other.getAppointmentTime().getHour() * 60 + other.getAppointmentTime().getMinute();
            int otherEnd = otherStart + Math.max(1, other.getDurationMinutes());
            if (newStartMin < otherEnd && otherStart < newEndMin) {
                return true;
            }
        }
        return false;
    }
}
