package com.curalithra.web.service;

import com.curalithra.web.dto.*;
import com.curalithra.web.entity.BillEntity;
import com.curalithra.web.entity.MedicalRecordEntity;
import com.curalithra.web.entity.PatientEntity;
import com.curalithra.web.entity.UserEntity;
import com.curalithra.web.enums.RolePermission;
import com.curalithra.web.exception.ConflictException;
import com.curalithra.web.exception.NotFoundException;
import com.curalithra.web.repository.*;
import com.curalithra.web.security.PermissionService;
import com.curalithra.web.util.DomainValidators;
import com.curalithra.web.util.DtoMapper;
import com.curalithra.web.util.PaginationUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class PatientService {

    private static final Map<String, String> ALLOWED_SORTS = Map.of(
            "registeredAt", "registeredAt",
            "fullName", "fullName",
            "patientCode", "patientCode",
            "dateOfBirth", "dateOfBirth"
    );

    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final BillRepository billRepository;
    private final SequenceRepository sequenceRepository;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public PatientService(PatientRepository patientRepository,
                          AppointmentRepository appointmentRepository,
                          MedicalRecordRepository medicalRecordRepository,
                          BillRepository billRepository,
                          SequenceRepository sequenceRepository,
                          PermissionService permissionService,
                          AuditLogService auditLogService,
                          Clock clock) {
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.medicalRecordRepository = medicalRecordRepository;
        this.billRepository = billRepository;
        this.sequenceRepository = sequenceRepository;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CommonDtos.PagedResponse<PatientDtos.PatientDto> searchPatients(
            String query, String gender, String bloodGroup, int page, int size, String sortBy, String sortDir) {
        permissionService.requirePermission(RolePermission.VIEW_PATIENTS);
        String cleanQuery = DomainValidators.optionalTrimmed(query);
        String cleanGender = ("All".equalsIgnoreCase(gender) || gender == null) ? "" : gender.trim();
        String cleanBlood = ("All".equalsIgnoreCase(bloodGroup) || bloodGroup == null) ? "" : bloodGroup.trim();
        Pageable pageable = PaginationUtils.createPageable(page, size, sortBy, sortDir, ALLOWED_SORTS, "registeredAt");
        Page<PatientEntity> result = patientRepository.searchAndFilter(cleanQuery, cleanGender, cleanBlood, pageable);
        return PaginationUtils.toPagedResponse(result, DtoMapper::toPatientDto);
    }

    @Transactional(readOnly = true)
    public PatientDtos.PatientDto getPatient(long id) {
        permissionService.requirePermission(RolePermission.VIEW_PATIENTS);
        PatientEntity patient = patientRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Patient record not found (ID: " + id + ")."));
        return DtoMapper.toPatientDto(patient);
    }

    @Transactional(readOnly = true)
    public PatientDtos.PatientHistoryDto getPatientHistory(long id) {
        permissionService.requirePermission(RolePermission.VIEW_PATIENTS);
        PatientEntity patient = patientRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Patient record not found (ID: " + id + ")."));

        List<AppointmentDtos.AppointmentDto> appointments = permissionService.hasPermission(RolePermission.VIEW_APPOINTMENTS)
                ? appointmentRepository.findByPatientIdOrderByAppointmentDateDescAppointmentTimeDesc(id)
                        .stream().map(DtoMapper::toAppointmentDto).toList()
                : List.of();

        boolean clinicalAccess = permissionService.hasPermission(RolePermission.VIEW_MEDICAL_RECORDS);
        List<MedicalRecordDtos.MedicalRecordDto> medicalRecords = List.of();
        if (clinicalAccess) {
            List<MedicalRecordEntity> recs = medicalRecordRepository.findByPatientIdOrderByVisitDateDescIdDesc(id);
            recs.forEach(r -> r.getPrescriptions().size());
            medicalRecords = recs.stream().map(DtoMapper::toMedicalRecordDto).toList();
        }

        List<BillingDtos.BillDto> bills = List.of();
        if (permissionService.hasPermission(RolePermission.VIEW_BILLING)) {
            Page<BillEntity> billPage = billRepository.searchAndFilter(
                    "", false, null, id,
                    OffsetDateTime.of(1900, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC),
                    OffsetDateTime.of(2999, 12, 31, 23, 59, 59, 0, ZoneOffset.UTC),
                    Pageable.ofSize(50));
            billPage.forEach(b -> {
                b.getItems().size();
                b.getPayments().size();
            });
            bills = billPage.getContent().stream().map(DtoMapper::toBillDto).toList();
        }

        return new PatientDtos.PatientHistoryDto(
                DtoMapper.toPatientDto(patient),
                appointments,
                medicalRecords,
                clinicalAccess,
                bills
        );
    }

    @Transactional
    public PatientDtos.PatientDto registerPatient(PatientDtos.PatientRequest req) {
        permissionService.requirePermission(RolePermission.EDIT_PATIENTS);
        UserEntity actor = permissionService.requireCurrentUserEntity();

        PatientEntity entity = new PatientEntity();
        applyAndValidate(entity, req);

        Optional<PatientEntity> duplicate = patientRepository.findByPhone(entity.getPhone());
        if (duplicate.isPresent()) {
            throw new ConflictException(
                    "A patient (" + duplicate.get().getPatientCode() + " - " + duplicate.get().getFullName()
                            + ") is already registered with phone number " + entity.getPhone() + ".");
        }

        entity.setPatientCode("PAT-" + sequenceRepository.nextPatientNumber());
        entity.setRegisteredAt(OffsetDateTime.now(clock));
        PatientEntity saved = patientRepository.save(entity);

        auditLogService.record(actor, "CREATE", "PATIENT", saved.getPatientCode(),
                "Registered patient " + saved.getFullName());
        return DtoMapper.toPatientDto(saved);
    }

    @Transactional
    public PatientDtos.PatientDto updatePatient(long id, PatientDtos.PatientRequest req) {
        permissionService.requirePermission(RolePermission.EDIT_PATIENTS);
        UserEntity actor = permissionService.requireCurrentUserEntity();

        PatientEntity entity = patientRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Patient record not found (ID: " + id + ")."));
        applyAndValidate(entity, req);

        Optional<PatientEntity> existingPhone = patientRepository.findByPhone(entity.getPhone());
        if (existingPhone.isPresent() && !existingPhone.get().getId().equals(id)) {
            throw new ConflictException("Phone number " + entity.getPhone() + " belongs to another patient.");
        }

        PatientEntity saved = patientRepository.save(entity);
        auditLogService.record(actor, "UPDATE", "PATIENT", saved.getPatientCode(),
                "Updated patient profile for " + saved.getFullName());
        return DtoMapper.toPatientDto(saved);
    }

    @Transactional
    public void deletePatient(long id) {
        permissionService.requirePermission(RolePermission.DELETE_PATIENTS);
        UserEntity actor = permissionService.requireCurrentUserEntity();

        PatientEntity existing = patientRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Patient record not found (ID: " + id + ")."));
        patientRepository.delete(existing);
        patientRepository.flush();

        auditLogService.record(actor, "DELETE", "PATIENT", existing.getPatientCode(),
                "Deleted patient record " + existing.getFullName());
    }

    private void applyAndValidate(PatientEntity entity, PatientDtos.PatientRequest req) {
        entity.setFullName(DomainValidators.requireNonBlank(req.fullName(), "Full name"));
        entity.setDateOfBirth(DomainValidators.validateDateOfBirth(req.dateOfBirth(), clock.getZone()));
        entity.setGender(DomainValidators.requireNonBlank(req.gender(), "Gender"));
        entity.setPhone(DomainValidators.validatePhone(req.phone(), true));
        String cleanEmail = DomainValidators.validateEmail(req.email(), false);
        entity.setEmail(cleanEmail.isEmpty() ? null : cleanEmail);
        entity.setAddress(DomainValidators.optionalTrimmed(req.address()));
        entity.setBloodGroup(DomainValidators.validateBloodGroup(req.bloodGroup()));
        entity.setEmergencyContact(DomainValidators.optionalTrimmed(req.emergencyContact()));
        entity.setBp(DomainValidators.optionalTrimmed(req.bp()));
        entity.setSugar(DomainValidators.optionalTrimmed(req.sugar()));
        entity.setWeightKg(DomainValidators.optionalTrimmed(req.weightKg()));
        entity.setHeightCm(DomainValidators.optionalTrimmed(req.heightCm()));
    }
}
