package com.curalithra.web.service;

import com.curalithra.web.dto.*;
import com.curalithra.web.entity.DepartmentEntity;
import com.curalithra.web.entity.DoctorEntity;
import com.curalithra.web.entity.UserEntity;
import com.curalithra.web.enums.RolePermission;
import com.curalithra.web.exception.ConflictException;
import com.curalithra.web.exception.NotFoundException;
import com.curalithra.web.exception.ValidationException;
import com.curalithra.web.repository.AppointmentRepository;
import com.curalithra.web.repository.DepartmentRepository;
import com.curalithra.web.repository.DoctorRepository;
import com.curalithra.web.repository.SequenceRepository;
import com.curalithra.web.security.PermissionService;
import com.curalithra.web.util.DomainValidators;
import com.curalithra.web.util.DtoMapper;
import com.curalithra.web.util.PaginationUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class DoctorService {

    private static final Map<String, String> ALLOWED_SORTS = Map.of(
            "doctorCode", "doctorCode",
            "fullName", "fullName",
            "specialization", "specialization",
            "experienceYears", "experienceYears",
            "consultationFee", "consultationFee",
            "createdAt", "createdAt"
    );

    private final DoctorRepository doctorRepository;
    private final DepartmentRepository departmentRepository;
    private final AppointmentRepository appointmentRepository;
    private final SequenceRepository sequenceRepository;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public DoctorService(DoctorRepository doctorRepository,
                         DepartmentRepository departmentRepository,
                         AppointmentRepository appointmentRepository,
                         SequenceRepository sequenceRepository,
                         PermissionService permissionService,
                         AuditLogService auditLogService,
                         Clock clock) {
        this.doctorRepository = doctorRepository;
        this.departmentRepository = departmentRepository;
        this.appointmentRepository = appointmentRepository;
        this.sequenceRepository = sequenceRepository;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<DoctorDtos.DepartmentDto> listDepartments() {
        permissionService.requirePermission(RolePermission.VIEW_DOCTORS);
        return departmentRepository.findByDemoRecordOrderByNameAsc(permissionService.isCurrentDemoUser()).stream()
                .map(DtoMapper::toDepartmentDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<String> listSpecializations() {
        permissionService.requirePermission(RolePermission.VIEW_DOCTORS);
        return doctorRepository.findDistinctSpecializations(permissionService.isCurrentDemoUser());
    }

    @Transactional(readOnly = true)
    public CommonDtos.PagedResponse<DoctorDtos.DoctorDto> searchDoctors(
            String query, String specialization, int page, int size, String sortBy, String sortDir) {
        permissionService.requirePermission(RolePermission.VIEW_DOCTORS);
        boolean demoScope = permissionService.isCurrentDemoUser();
        String cleanQuery = DomainValidators.optionalTrimmed(query);
        String cleanSpec = ("All".equalsIgnoreCase(specialization) || specialization == null) ? "" : specialization.trim();
        Pageable pageable = PaginationUtils.createPageable(page, size, sortBy, sortDir, ALLOWED_SORTS, "doctorCode");
        Page<DoctorEntity> result = doctorRepository.searchAndFilter(cleanQuery, cleanSpec, demoScope, pageable);
        return PaginationUtils.toPagedResponse(result, DtoMapper::toDoctorDto);
    }

    @Transactional(readOnly = true)
    public DoctorDtos.DoctorDto getDoctor(long id) {
        permissionService.requirePermission(RolePermission.VIEW_DOCTORS);
        DoctorEntity doctor = doctorRepository.findWithDepartmentById(id)
                .orElseThrow(() -> new NotFoundException("Doctor profile not found."));
        permissionService.verifySameScope(doctor.isDemoRecord(), "Doctor profile");
        return DtoMapper.toDoctorDto(doctor);
    }

    @Transactional(readOnly = true)
    public List<AppointmentDtos.AppointmentDto> getDoctorAppointments(long doctorId) {
        permissionService.requirePermission(RolePermission.VIEW_APPOINTMENTS);
        boolean demoScope = permissionService.isCurrentDemoUser();
        DoctorEntity doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new NotFoundException("Doctor profile not found."));
        permissionService.verifySameScope(doctor.isDemoRecord(), "Doctor profile");
        return appointmentRepository.findByDoctorIdOrderByAppointmentDateDescAppointmentTimeDesc(doctorId)
                .stream()
                .filter(a -> a.isDemoRecord() == demoScope)
                .map(DtoMapper::toAppointmentDto)
                .toList();
    }

    @Transactional
    public DoctorDtos.DoctorDto createDoctor(DoctorDtos.DoctorRequest req) {
        permissionService.requirePermission(RolePermission.EDIT_DOCTORS);
        UserEntity actor = permissionService.requireCurrentUserEntity();
        boolean demoScope = actor.isDemoUser();

        DoctorEntity entity = new DoctorEntity();
        entity.setDemoRecord(demoScope);
        applyAndValidate(entity, req);

        if (doctorRepository.findByEmailIgnoreCaseAndDemoRecord(entity.getEmail(), demoScope).isPresent()) {
            throw new ConflictException("A doctor with email '" + entity.getEmail() + "' already exists.");
        }

        entity.setDoctorCode("DOC-" + sequenceRepository.nextDoctorNumber());
        entity.setCreatedAt(OffsetDateTime.now(clock));
        DoctorEntity saved = doctorRepository.save(entity);

        auditLogService.record(actor, "CREATE", "DOCTOR", saved.getDoctorCode(),
                "Added doctor " + saved.getFullName() + " (" + saved.getSpecialization() + ")");
        return DtoMapper.toDoctorDto(saved);
    }

    @Transactional
    public DoctorDtos.DoctorDto updateDoctor(long id, DoctorDtos.DoctorRequest req) {
        permissionService.requirePermission(RolePermission.EDIT_DOCTORS);
        UserEntity actor = permissionService.requireCurrentUserEntity();

        DoctorEntity entity = doctorRepository.findWithDepartmentById(id)
                .orElseThrow(() -> new NotFoundException("Doctor profile not found."));
        permissionService.verifySameScope(entity.isDemoRecord(), "Doctor profile");
        applyAndValidate(entity, req);

        Optional<DoctorEntity> duplicateEmail = doctorRepository.findByEmailIgnoreCaseAndDemoRecord(
                entity.getEmail(), entity.isDemoRecord());
        if (duplicateEmail.isPresent() && !duplicateEmail.get().getId().equals(id)) {
            throw new ConflictException("Email '" + entity.getEmail() + "' is assigned to another doctor.");
        }

        DoctorEntity saved = doctorRepository.save(entity);
        auditLogService.record(actor, "UPDATE", "DOCTOR", saved.getDoctorCode(),
                "Updated doctor profile " + saved.getFullName());
        return DtoMapper.toDoctorDto(saved);
    }

    @Transactional
    public void deleteDoctor(long id) {
        permissionService.requirePermission(RolePermission.DELETE_DOCTORS);
        permissionService.forbidDemoMutation("Deleting doctors");
        UserEntity actor = permissionService.requireCurrentUserEntity();

        DoctorEntity existing = doctorRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Doctor profile not found."));
        permissionService.verifySameScope(existing.isDemoRecord(), "Doctor profile");
        doctorRepository.delete(existing);
        doctorRepository.flush();

        auditLogService.record(actor, "DELETE", "DOCTOR", existing.getDoctorCode(),
                "Removed doctor " + existing.getFullName());
    }

    private void applyAndValidate(DoctorEntity entity, DoctorDtos.DoctorRequest req) {
        DepartmentEntity dept = departmentRepository.findById(req.departmentId())
                .orElseThrow(() -> new ValidationException("Please select a valid hospital department."));
        permissionService.verifySameScope(dept.isDemoRecord(), "Department");
        entity.setFullName(DomainValidators.requireNonBlank(req.fullName(), "Doctor full name"));
        entity.setSpecialization(DomainValidators.requireNonBlank(req.specialization(), "Specialization"));
        entity.setDepartment(dept);
        entity.setPhone(DomainValidators.validatePhone(req.phone(), true));
        entity.setEmail(DomainValidators.validateEmail(req.email(), true));
        entity.setQualification(DomainValidators.requireNonBlank(req.qualification(), "Qualification"));
        if (req.experienceYears() < 0 || req.experienceYears() > 75) {
            throw new ValidationException("Years of experience must be between 0 and 75.");
        }
        entity.setExperienceYears(req.experienceYears());
        entity.setAvailabilitySchedule(DomainValidators.requireNonBlank(req.availabilitySchedule(), "Availability schedule"));
        entity.setConsultationFee(DomainValidators.validateNonNegativeAmount(req.consultationFee(), "Consultation fee")
                .setScale(2, RoundingMode.HALF_UP));
        entity.setActive(req.active());
    }
}
