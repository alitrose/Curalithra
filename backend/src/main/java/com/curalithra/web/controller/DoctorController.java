package com.curalithra.web.controller;

import com.curalithra.web.dto.AppointmentDtos;
import com.curalithra.web.dto.CommonDtos;
import com.curalithra.web.dto.DoctorDtos;
import com.curalithra.web.service.DoctorService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/doctors")
public class DoctorController {

    private final DoctorService doctorService;

    public DoctorController(DoctorService doctorService) {
        this.doctorService = doctorService;
    }

    @GetMapping
    public CommonDtos.PagedResponse<DoctorDtos.DoctorDto> listDoctors(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "") String specialization,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "doctorCode") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        return doctorService.searchDoctors(query, specialization, page, size, sortBy, sortDir);
    }

    @GetMapping("/departments")
    public List<DoctorDtos.DepartmentDto> listDepartments() {
        return doctorService.listDepartments();
    }

    @GetMapping("/specializations")
    public List<String> listSpecializations() {
        return doctorService.listSpecializations();
    }

    @GetMapping("/{id}")
    public DoctorDtos.DoctorDto getDoctor(@PathVariable long id) {
        return doctorService.getDoctor(id);
    }

    @GetMapping("/{id}/appointments")
    public List<AppointmentDtos.AppointmentDto> getDoctorAppointments(@PathVariable long id) {
        return doctorService.getDoctorAppointments(id);
    }

    @PostMapping
    public ResponseEntity<DoctorDtos.DoctorDto> createDoctor(@Valid @RequestBody DoctorDtos.DoctorRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(doctorService.createDoctor(req));
    }

    @PutMapping("/{id}")
    public DoctorDtos.DoctorDto updateDoctor(
            @PathVariable long id,
            @Valid @RequestBody DoctorDtos.DoctorRequest req) {
        return doctorService.updateDoctor(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDoctor(@PathVariable long id) {
        doctorService.deleteDoctor(id);
        return ResponseEntity.noContent().build();
    }
}
