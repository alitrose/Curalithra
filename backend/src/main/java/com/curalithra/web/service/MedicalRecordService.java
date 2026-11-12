package com.curalithra.web.service;

import com.curalithra.web.dto.CommonDtos;
import com.curalithra.web.dto.MedicalRecordDtos;
import com.curalithra.web.entity.*;
import com.curalithra.web.enums.PrescriptionStatus;
import com.curalithra.web.enums.RolePermission;
import com.curalithra.web.exception.NotFoundException;
import com.curalithra.web.exception.ValidationException;
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
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Service
public class MedicalRecordService {

    private static final Map<String, String> RECORD_SORTS = Map.of(
            "visitDate", "visitDate",
            "recordCode", "recordCode",
            "createdAt", "createdAt"
    );
    private static final Map<String, String> RX_SORTS = Map.of(
            "prescribedAt", "prescribedAt",
            "medicationName", "medicationName",
            "status", "status"
    );

    private final MedicalRecordRepository medicalRecordRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final SequenceRepository sequenceRepository;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public MedicalRecordService(MedicalRecordRepository medicalRecordRepository,
                                PrescriptionRepository prescriptionRepository,
                                PatientRepository patientRepository,
                                DoctorRepository doctorRepository,
                                AppointmentRepository appointmentRepository,
                                SequenceRepository sequenceRepository,
                                PermissionService permissionService,
                                AuditLogService auditLogService,
                                Clock clock) {
        this.medicalRecordRepository = medicalRecordRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentRepository = appointmentRepository;
        this.sequenceRepository = sequenceRepository;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CommonDtos.PagedResponse<MedicalRecordDtos.MedicalRecordDto> searchRecords(
            String query, Long patientId, int page, int size, String sortBy, String sortDir) {
        permissionService.requirePermission(RolePermission.VIEW_MEDICAL_RECORDS);
        boolean demoScope = permissionService.isCurrentDemoUser();
        String cleanQuery = DomainValidators.optionalTrimmed(query);
        Pageable pageable = PaginationUtils.createPageable(page, size, sortBy, sortDir, RECORD_SORTS, "visitDate");
        Page<MedicalRecordEntity> result = medicalRecordRepository.searchAndFilter(
                cleanQuery, patientId != null ? patientId : 0L, demoScope, pageable);
        result.forEach(r -> r.getPrescriptions().size());
        return PaginationUtils.toPagedResponse(result, DtoMapper::toMedicalRecordDto);
    }

    @Transactional(readOnly = true)
    public MedicalRecordDtos.MedicalRecordDto getRecord(long id) {
        permissionService.requirePermission(RolePermission.VIEW_MEDICAL_RECORDS);
        MedicalRecordEntity record = medicalRecordRepository.findHydratedById(id)
                .orElseThrow(() -> new NotFoundException("Medical record not found."));
        permissionService.verifySameScope(record.isDemoRecord(), "Medical record");
        record.getPrescriptions().size();
        return DtoMapper.toMedicalRecordDto(record);
    }

    @Transactional
    public MedicalRecordDtos.MedicalRecordDto createRecord(MedicalRecordDtos.MedicalRecordRequest req) {
        permissionService.requirePermission(RolePermission.EDIT_MEDICAL_RECORDS);
        permissionService.forbidDemoMutation("Creating medical records");
        UserEntity actor = permissionService.requireCurrentUserEntity();

        MedicalRecordEntity entity = new MedicalRecordEntity();
        entity.setRecordCode("REC-" + sequenceRepository.nextMedicalRecordNumber());
        entity.setDemoRecord(actor.isDemoUser());
        entity.setCreatedAt(OffsetDateTime.now(clock));
        applyAndValidate(entity, req);

        MedicalRecordEntity saved = medicalRecordRepository.save(entity);
        auditLogService.record(actor, "CREATE", "MEDICAL_RECORD", saved.getRecordCode(),
                "Recorded clinical assessment for " + saved.getPatient().getFullName());
        return DtoMapper.toMedicalRecordDto(saved);
    }

    @Transactional
    public MedicalRecordDtos.MedicalRecordDto updateRecord(long id, MedicalRecordDtos.MedicalRecordRequest req) {
        permissionService.requirePermission(RolePermission.EDIT_MEDICAL_RECORDS);
        permissionService.forbidDemoMutation("Updating medical records");
        UserEntity actor = permissionService.requireCurrentUserEntity();

        MedicalRecordEntity entity = medicalRecordRepository.findHydratedById(id)
                .orElseThrow(() -> new NotFoundException("Medical record not found."));
        permissionService.verifySameScope(entity.isDemoRecord(), "Medical record");
        applyAndValidate(entity, req);

        MedicalRecordEntity saved = medicalRecordRepository.save(entity);
        auditLogService.record(actor, "UPDATE", "MEDICAL_RECORD", saved.getRecordCode(),
                "Updated clinical assessment for " + saved.getPatient().getFullName());
        return DtoMapper.toMedicalRecordDto(saved);
    }

    @Transactional(readOnly = true)
    public CommonDtos.PagedResponse<MedicalRecordDtos.PrescriptionDto> listPrescriptions(
            String query, PrescriptionStatus status, Long patientId, Long recordId, int page, int size, String sortBy, String sortDir) {
        permissionService.requirePermission(RolePermission.VIEW_MEDICAL_RECORDS);
        boolean demoScope = permissionService.isCurrentDemoUser();
        String cleanQuery = DomainValidators.optionalTrimmed(query);
        Pageable pageable = PaginationUtils.createPageable(page, size, sortBy, sortDir, RX_SORTS, "prescribedAt");
        Page<PrescriptionEntity> result = prescriptionRepository.searchByFilters(
                cleanQuery,
                status != null,
                status != null ? status : PrescriptionStatus.ACTIVE,
                patientId != null ? patientId : 0L,
                recordId != null ? recordId : 0L,
                demoScope,
                pageable);
        return PaginationUtils.toPagedResponse(result, DtoMapper::toPrescriptionDto);
    }

    @Transactional(readOnly = true)
    public MedicalRecordDtos.PrescriptionDto getPrescription(long id) {
        permissionService.requirePermission(RolePermission.VIEW_MEDICAL_RECORDS);
        PrescriptionEntity rx = prescriptionRepository.findHydratedById(id)
                .orElseThrow(() -> new NotFoundException("Prescription not found."));
        permissionService.verifySameScope(rx.isDemoRecord(), "Prescription");
        return DtoMapper.toPrescriptionDto(rx);
    }

    @Transactional
    public MedicalRecordDtos.PrescriptionDto createStandalonePrescription(MedicalRecordDtos.StandalonePrescriptionRequest req) {
        permissionService.requirePermission(RolePermission.EDIT_MEDICAL_RECORDS);
        permissionService.forbidDemoMutation("Issuing prescriptions");
        UserEntity actor = permissionService.requireCurrentUserEntity();
        boolean demoScope = actor.isDemoUser();

        PatientEntity patient = patientRepository.findById(req.patientId())
                .orElseThrow(() -> new NotFoundException("Selected patient does not exist."));
        permissionService.verifySameScope(patient.isDemoRecord(), "Selected patient");
        DoctorEntity doctor = doctorRepository.findWithDepartmentById(req.doctorId())
                .orElseThrow(() -> new NotFoundException("Selected doctor does not exist."));
        permissionService.verifySameScope(doctor.isDemoRecord(), "Selected doctor");

        MedicalRecordEntity record;
        if (req.medicalRecordId() != null) {
            record = medicalRecordRepository.findHydratedById(req.medicalRecordId())
                    .orElseThrow(() -> new NotFoundException("Selected medical record does not exist."));
            permissionService.verifySameScope(record.isDemoRecord(), "Selected medical record");
            if (!record.getPatient().getId().equals(patient.getId())) {
                throw new ValidationException("Selected medical record does not belong to the selected patient.");
            }
        } else {
            String context = DomainValidators.optionalTrimmed(req.clinicalContext());
            String summaryText = context.isEmpty()
                    ? "Outpatient prescription consultation (" + req.medicationName().trim() + ")"
                    : context;
            record = new MedicalRecordEntity();
            record.setRecordCode("REC-" + sequenceRepository.nextMedicalRecordNumber());
            record.setDemoRecord(demoScope);
            record.setPatient(patient);
            record.setDoctor(doctor);
            record.setVisitDate(LocalDate.now(clock));
            record.setSymptoms(summaryText);
            record.setDiagnosis(summaryText);
            record.setTreatment("Pharmacotherapy prescribed: " + req.medicationName().trim() + " " + req.dosage().trim());
            record.setCreatedAt(OffsetDateTime.now(clock));
            record = medicalRecordRepository.save(record);
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        PrescriptionEntity rx = new PrescriptionEntity();
        rx.setMedicalRecord(record);
        rx.setDemoRecord(demoScope);
        rx.setPatient(patient);
        rx.setDoctor(doctor);
        rx.setMedicationName(DomainValidators.requireNonBlank(req.medicationName(), "Medication name"));
        rx.setDosage(DomainValidators.requireNonBlank(req.dosage(), "Dosage"));
        rx.setFrequency(DomainValidators.requireNonBlank(req.frequency(), "Frequency"));
        rx.setDurationDays(req.durationDays());
        rx.setInstructions(DomainValidators.optionalTrimmed(req.instructions()));
        rx.setStatus(req.status() == null ? PrescriptionStatus.ACTIVE : req.status());
        rx.setPrescribedAt(now);

        PrescriptionEntity saved = prescriptionRepository.save(rx);
        auditLogService.record(actor, "CREATE", "PRESCRIPTION", String.valueOf(saved.getId()),
                "Prescribed " + saved.getMedicationName() + " for " + patient.getFullName());
        return DtoMapper.toPrescriptionDto(saved);
    }

    @Transactional
    public MedicalRecordDtos.PrescriptionDto updatePrescriptionStatus(long prescriptionId, PrescriptionStatus status) {
        permissionService.requirePermission(RolePermission.EDIT_MEDICAL_RECORDS);
        permissionService.forbidDemoMutation("Updating prescription status");
        UserEntity actor = permissionService.requireCurrentUserEntity();
        if (status == null) {
            throw new ValidationException("Prescription status is required.");
        }
        PrescriptionEntity rx = prescriptionRepository.findHydratedById(prescriptionId)
                .orElseThrow(() -> new NotFoundException("Prescription not found."));
        permissionService.verifySameScope(rx.isDemoRecord(), "Prescription");
        rx.setStatus(status);
        PrescriptionEntity saved = prescriptionRepository.save(rx);

        auditLogService.record(actor, "STATUS", "PRESCRIPTION", String.valueOf(prescriptionId),
                "Updated prescription status to " + status.getDisplayName());
        return DtoMapper.toPrescriptionDto(saved);
    }

    private void applyAndValidate(MedicalRecordEntity entity, MedicalRecordDtos.MedicalRecordRequest req) {
        PatientEntity patient = patientRepository.findById(req.patientId())
                .orElseThrow(() -> new NotFoundException("Selected patient does not exist."));
        permissionService.verifySameScope(patient.isDemoRecord(), "Selected patient");
        DoctorEntity doctor = doctorRepository.findWithDepartmentById(req.doctorId())
                .orElseThrow(() -> new NotFoundException("Selected doctor does not exist."));
        permissionService.verifySameScope(doctor.isDemoRecord(), "Selected doctor");
        AppointmentEntity appointment = null;
        if (req.appointmentId() != null) {
            appointment = appointmentRepository.findById(req.appointmentId())
                    .orElseThrow(() -> new NotFoundException("Selected appointment does not exist."));
            permissionService.verifySameScope(appointment.isDemoRecord(), "Selected appointment");
        }

        entity.setPatient(patient);
        entity.setDoctor(doctor);
        entity.setAppointment(appointment);
        entity.setVisitDate(req.visitDate());
        entity.setSymptoms(DomainValidators.requireNonBlank(req.symptoms(), "Symptoms"));
        entity.setDiagnosis(DomainValidators.requireNonBlank(req.diagnosis(), "Diagnosis"));
        entity.setTreatment(DomainValidators.requireNonBlank(req.treatment(), "Treatment plan"));
        entity.setVitalsBp(DomainValidators.optionalTrimmed(req.vitalsBp()));
        entity.setVitalsTemp(DomainValidators.optionalTrimmed(req.vitalsTemp()));
        entity.setNotes(DomainValidators.optionalTrimmed(req.notes()));

        entity.getPrescriptions().clear();
        List<MedicalRecordDtos.PrescriptionRequest> rxRequests = req.prescriptions() == null ? List.of() : req.prescriptions();
        OffsetDateTime now = OffsetDateTime.now(clock);
        for (MedicalRecordDtos.PrescriptionRequest rxReq : rxRequests) {
            PrescriptionEntity rx = new PrescriptionEntity();
            rx.setMedicalRecord(entity);
            rx.setDemoRecord(entity.isDemoRecord());
            rx.setPatient(patient);
            rx.setDoctor(doctor);
            rx.setMedicationName(DomainValidators.requireNonBlank(rxReq.medicationName(), "Medication name"));
            rx.setDosage(DomainValidators.requireNonBlank(rxReq.dosage(), "Dosage"));
            rx.setFrequency(DomainValidators.requireNonBlank(rxReq.frequency(), "Frequency"));
            rx.setDurationDays(rxReq.durationDays());
            rx.setInstructions(DomainValidators.optionalTrimmed(rxReq.instructions()));
            rx.setStatus(rxReq.status() == null ? PrescriptionStatus.ACTIVE : rxReq.status());
            rx.setPrescribedAt(now);
            entity.getPrescriptions().add(rx);
        }
    }
}
