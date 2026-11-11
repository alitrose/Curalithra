package com.curalithra.web.controller;

import com.curalithra.web.dto.CommonDtos;
import com.curalithra.web.dto.MedicalRecordDtos;
import com.curalithra.web.service.MedicalRecordService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/medical-records")
public class MedicalRecordController {

    private final MedicalRecordService medicalRecordService;

    public MedicalRecordController(MedicalRecordService medicalRecordService) {
        this.medicalRecordService = medicalRecordService;
    }

    @GetMapping
    public CommonDtos.PagedResponse<MedicalRecordDtos.MedicalRecordDto> listRecords(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) Long patientId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "visitDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        return medicalRecordService.searchRecords(query, patientId, page, size, sortBy, sortDir);
    }

    @GetMapping("/{id}")
    public MedicalRecordDtos.MedicalRecordDto getRecord(@PathVariable long id) {
        return medicalRecordService.getRecord(id);
    }

    @PostMapping
    public ResponseEntity<MedicalRecordDtos.MedicalRecordDto> createRecord(
            @Valid @RequestBody MedicalRecordDtos.MedicalRecordRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(medicalRecordService.createRecord(req));
    }

    @PutMapping("/{id}")
    public MedicalRecordDtos.MedicalRecordDto updateRecord(
            @PathVariable long id,
            @Valid @RequestBody MedicalRecordDtos.MedicalRecordRequest req) {
        return medicalRecordService.updateRecord(id, req);
    }
}
