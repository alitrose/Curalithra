package com.curalithra.web.controller;

import com.curalithra.web.dto.CommonDtos;
import com.curalithra.web.dto.DashboardAndReportDtos;
import com.curalithra.web.enums.ReportType;
import com.curalithra.web.service.AuditLogService;
import com.curalithra.web.service.ReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Locale;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;
    private final AuditLogService auditLogService;

    public ReportController(ReportService reportService, AuditLogService auditLogService) {
        this.reportService = reportService;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public DashboardAndReportDtos.ReportResultDto generateReport(
            @RequestParam(defaultValue = "PATIENT_REGISTRATION") ReportType type,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return reportService.generateReport(type, search, fromDate, toDate);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv(
            @RequestParam(defaultValue = "PATIENT_REGISTRATION") ReportType type,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        String csv = reportService.exportCsv(type, search, fromDate, toDate);
        String filename = "curalithra-" + type.name().toLowerCase(Locale.ROOT) + ".csv";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(new MediaType("text", "csv", StandardCharsets.UTF_8));
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename(filename, StandardCharsets.UTF_8)
                .build());
        return ResponseEntity.ok().headers(headers).body(csv.getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/audit-logs")
    public CommonDtos.PagedResponse<CommonDtos.ActivityLogDto> auditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return auditLogService.listAuditLogs(page, size);
    }
}
