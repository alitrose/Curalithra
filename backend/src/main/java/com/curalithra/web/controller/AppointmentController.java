package com.curalithra.web.controller;

import com.curalithra.web.dto.AppointmentDtos;
import com.curalithra.web.dto.CommonDtos;
import com.curalithra.web.enums.AppointmentStatus;
import com.curalithra.web.service.AppointmentService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {

    private final AppointmentService appointmentService;

    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @GetMapping
    public CommonDtos.PagedResponse<AppointmentDtos.AppointmentDto> listAppointments(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) AppointmentStatus status,
            @RequestParam(required = false) Long doctorId,
            @RequestParam(required = false) Long patientId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "appointmentDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        return appointmentService.searchAppointments(query, status, doctorId, patientId, fromDate, toDate, page, size, sortBy, sortDir);
    }

    @GetMapping("/calendar")
    public List<AppointmentDtos.CalendarDayGroupDto> calendarView(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) AppointmentStatus status,
            @RequestParam(required = false) Long doctorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return appointmentService.getCalendarView(query, status, doctorId, fromDate, toDate);
    }

    @GetMapping("/{id}")
    public AppointmentDtos.AppointmentDto getAppointment(@PathVariable long id) {
        return appointmentService.getAppointment(id);
    }

    @PostMapping
    public ResponseEntity<AppointmentDtos.AppointmentDto> scheduleAppointment(
            @Valid @RequestBody AppointmentDtos.AppointmentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(appointmentService.scheduleAppointment(req));
    }

    @PutMapping("/{id}")
    public AppointmentDtos.AppointmentDto updateAppointment(
            @PathVariable long id,
            @Valid @RequestBody AppointmentDtos.AppointmentRequest req) {
        return appointmentService.updateAppointment(id, req);
    }

    @PatchMapping("/{id}/status")
    public AppointmentDtos.AppointmentDto updateStatus(
            @PathVariable long id,
            @Valid @RequestBody AppointmentDtos.AppointmentStatusUpdateRequest req) {
        return appointmentService.updateStatus(id, req.status());
    }

    @DeleteMapping("/{id}")
    public AppointmentDtos.AppointmentDto cancelAppointment(@PathVariable long id) {
        return appointmentService.cancelAppointment(id);
    }
}
