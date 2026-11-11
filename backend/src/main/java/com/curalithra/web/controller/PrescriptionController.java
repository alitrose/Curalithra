package com.curalithra.web.controller;

import com.curalithra.web.dto.CommonDtos;
import com.curalithra.web.dto.MedicalRecordDtos;
import com.curalithra.web.enums.PrescriptionStatus;
import com.curalithra.web.service.MedicalRecordService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/prescriptions")
public class PrescriptionController {

    private final MedicalRecordService medicalRecordService;

    public PrescriptionController(MedicalRecordService medicalRecordService) {
        this.medicalRecordService = medicalRecordService;
    }

    @GetMapping
    public CommonDtos.PagedResponse<MedicalRecordDtos.PrescriptionDto> listPrescriptions(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) PrescriptionStatus status,
            @RequestParam(required = false) Long patientId,
            @RequestParam(required = false) Long recordId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "prescribedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        return medicalRecordService.listPrescriptions(query, status, patientId, recordId, page, size, sortBy, sortDir);
    }

    @GetMapping("/{id}")
    public MedicalRecordDtos.PrescriptionDto getPrescription(@PathVariable long id) {
        return medicalRecordService.getPrescription(id);
    }

    @PostMapping
    public ResponseEntity<MedicalRecordDtos.PrescriptionDto> createPrescription(
            @Valid @RequestBody MedicalRecordDtos.StandalonePrescriptionRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(medicalRecordService.createStandalonePrescription(req));
    }

    @PatchMapping("/{id}/status")
    public MedicalRecordDtos.PrescriptionDto updatePrescriptionStatus(
            @PathVariable long id,
            @Valid @RequestBody MedicalRecordDtos.PrescriptionStatusUpdateRequest req) {
        return medicalRecordService.updatePrescriptionStatus(id, req.status());
    }
}
