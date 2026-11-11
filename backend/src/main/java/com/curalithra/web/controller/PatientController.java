package com.curalithra.web.controller;

import com.curalithra.web.dto.CommonDtos;
import com.curalithra.web.dto.PatientDtos;
import com.curalithra.web.service.PatientService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientService patientService;

    public PatientController(PatientService patientService) {
        this.patientService = patientService;
    }

    @GetMapping
    public CommonDtos.PagedResponse<PatientDtos.PatientDto> listPatients(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "") String gender,
            @RequestParam(defaultValue = "") String bloodGroup,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "registeredAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        return patientService.searchPatients(query, gender, bloodGroup, page, size, sortBy, sortDir);
    }

    @GetMapping("/{id}")
    public PatientDtos.PatientDto getPatient(@PathVariable long id) {
        return patientService.getPatient(id);
    }

    @GetMapping("/{id}/history")
    public PatientDtos.PatientHistoryDto getPatientHistory(@PathVariable long id) {
        return patientService.getPatientHistory(id);
    }

    @PostMapping
    public ResponseEntity<PatientDtos.PatientDto> createPatient(@Valid @RequestBody PatientDtos.PatientRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(patientService.registerPatient(req));
    }

    @PutMapping("/{id}")
    public PatientDtos.PatientDto updatePatient(
            @PathVariable long id,
            @Valid @RequestBody PatientDtos.PatientRequest req) {
        return patientService.updatePatient(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePatient(@PathVariable long id) {
        patientService.deletePatient(id);
        return ResponseEntity.noContent().build();
    }
}
