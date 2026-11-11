package com.curalithra.web.service;

import com.curalithra.web.dto.DashboardAndReportDtos;
import com.curalithra.web.entity.*;
import com.curalithra.web.enums.AppointmentStatus;
import com.curalithra.web.enums.PaymentStatus;
import com.curalithra.web.enums.ReportType;
import com.curalithra.web.enums.RolePermission;
import com.curalithra.web.repository.*;
import com.curalithra.web.security.PermissionService;
import com.curalithra.web.util.DomainValidators;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class ReportService {

    private static final LocalDate MIN_DATE = LocalDate.of(1900, 1, 1);
    private static final LocalDate MAX_DATE = LocalDate.of(2999, 12, 31);
    private static final DateTimeFormatter TS_DAY_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final BillRepository billRepository;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final SettingsService settingsService;
    private final Clock clock;

    public ReportService(PatientRepository patientRepository,
                         DoctorRepository doctorRepository,
                         AppointmentRepository appointmentRepository,
                         BillRepository billRepository,
                         PermissionService permissionService,
                         AuditLogService auditLogService,
                         SettingsService settingsService,
                         Clock clock) {
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentRepository = appointmentRepository;
        this.billRepository = billRepository;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.settingsService = settingsService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public DashboardAndReportDtos.ReportResultDto generateReport(
            ReportType type, String search, LocalDate fromDate, LocalDate toDate) {
        permissionService.requirePermission(RolePermission.VIEW_REPORTS);
        String q = DomainValidators.optionalTrimmed(search).toLowerCase(Locale.ROOT);
        LocalDate from = fromDate != null ? fromDate : MIN_DATE;
        LocalDate to = toDate != null ? toDate : MAX_DATE;

        return switch (type) {
            case PATIENT_REGISTRATION -> buildPatientReport(q, from, to);
            case DOCTOR_ACTIVITY -> buildDoctorActivityReport(q, from, to);
            case APPOINTMENTS -> buildAppointmentReport(q, from, to);
            case APPOINTMENT_STATUS -> buildStatusSummaryReport(from, to);
            case REVENUE -> buildRevenueReport(q, from, to);
        };
    }

    @Transactional
    public String exportCsv(ReportType type, String search, LocalDate fromDate, LocalDate toDate) {
        permissionService.requirePermission(RolePermission.EXPORT_REPORTS);
        DashboardAndReportDtos.ReportResultDto report = generateReport(type, search, fromDate, toDate);
        UserEntity actor = permissionService.requireCurrentUserEntity();

        StringBuilder sb = new StringBuilder();
        appendCsvRow(sb, report.headers());
        for (List<String> row : report.rows()) {
            appendCsvRow(sb, row);
        }

        auditLogService.record(actor, "EXPORT", "REPORT", type.name(),
                "Exported " + type.getTitle() + " (" + report.rows().size() + " rows)");
        return sb.toString();
    }

    private DashboardAndReportDtos.ReportResultDto buildPatientReport(String q, LocalDate from, LocalDate to) {
        boolean demoScope = permissionService.isCurrentDemoUser();
        ZoneId appZone = clock.getZone();
        List<PatientEntity> patients = patientRepository.searchAndFilter(
                q, "", "", demoScope, PageRequest.of(0, 1000, Sort.by(Sort.Direction.DESC, "registeredAt"))).getContent();
        List<String> headers = List.of("Patient ID", "Full Name", "Gender", "DOB", "Blood Group", "Phone", "Registered On");
        List<List<String>> rows = new ArrayList<>();
        for (PatientEntity p : patients) {
            ZonedDateTime registeredInZone = p.getRegisteredAt().atZoneSameInstant(appZone);
            LocalDate regDay = registeredInZone.toLocalDate();
            if (regDay.isBefore(from) || regDay.isAfter(to)) continue;
            rows.add(List.of(
                    p.getPatientCode(),
                    p.getFullName(),
                    p.getGender(),
                    p.getDateOfBirth().toString(),
                    p.getBloodGroup(),
                    p.getPhone(),
                    registeredInZone.format(TS_DAY_FMT)
            ));
        }
        Map<String, String> summary = new LinkedHashMap<>();
        summary.put("Total Matching Patients", String.valueOf(rows.size()));
        summary.put("Total Registry Size", String.valueOf(patientRepository.countByDemoRecord(demoScope)));
        return new DashboardAndReportDtos.ReportResultDto(
                ReportType.PATIENT_REGISTRATION, ReportType.PATIENT_REGISTRATION.getTitle(), headers, rows, summary);
    }

    private DashboardAndReportDtos.ReportResultDto buildDoctorActivityReport(String q, LocalDate from, LocalDate to) {
        boolean demoScope = permissionService.isCurrentDemoUser();
        List<DoctorEntity> doctors = doctorRepository.searchAndFilter(
                q, "", demoScope, PageRequest.of(0, 500, Sort.by(Sort.Direction.ASC, "doctorCode"))).getContent();
        List<AppointmentEntity> allApts = appointmentRepository.searchAndFilter(
                "", false, AppointmentStatus.SCHEDULED, 0L, 0L, from, to, demoScope, PageRequest.of(0, 2000)).getContent();

        List<String> headers = List.of("Doctor ID", "Doctor Name", "Specialization", "Department",
                "Total Visits", "Completed", "Pending", "Cancelled/No-Show");
        List<List<String>> rows = new ArrayList<>();
        int totalVisits = 0;

        for (DoctorEntity d : doctors) {
            List<AppointmentEntity> docApts = allApts.stream()
                    .filter(a -> a.getDoctor().getId().equals(d.getId())).toList();
            long completed = docApts.stream().filter(a -> a.getStatus() == AppointmentStatus.COMPLETED).count();
            long pending = docApts.stream().filter(a -> a.getStatus().blocksScheduleSlot()
                    && a.getStatus() != AppointmentStatus.COMPLETED).count();
            long missed = docApts.stream().filter(a -> !a.getStatus().blocksScheduleSlot()).count();
            totalVisits += docApts.size();
            rows.add(List.of(
                    d.getDoctorCode(),
                    d.getFullName(),
                    d.getSpecialization(),
                    d.getDepartment().getName(),
                    String.valueOf(docApts.size()),
                    String.valueOf(completed),
                    String.valueOf(pending),
                    String.valueOf(missed)
            ));
        }

        Map<String, String> summary = new LinkedHashMap<>();
        summary.put("Doctors Included", String.valueOf(rows.size()));
        summary.put("Total Visits in Range", String.valueOf(totalVisits));
        return new DashboardAndReportDtos.ReportResultDto(
                ReportType.DOCTOR_ACTIVITY, ReportType.DOCTOR_ACTIVITY.getTitle(), headers, rows, summary);
    }

    private DashboardAndReportDtos.ReportResultDto buildAppointmentReport(String q, LocalDate from, LocalDate to) {
        boolean demoScope = permissionService.isCurrentDemoUser();
        List<AppointmentEntity> list = appointmentRepository.searchAndFilter(
                q, false, AppointmentStatus.SCHEDULED, 0L, 0L, from, to, demoScope,
                PageRequest.of(0, 2000, Sort.by(Sort.Direction.DESC, "appointmentDate"))).getContent();

        List<String> headers = List.of("Appt ID", "Date", "Time", "Patient", "Doctor", "Specialization", "Status", "Reason");
        List<List<String>> rows = new ArrayList<>();
        for (AppointmentEntity a : list) {
            rows.add(List.of(
                    a.getAppointmentCode(),
                    a.getAppointmentDate().toString(),
                    a.getAppointmentTime().toString().substring(0, 5),
                    a.getPatient().getFullName(),
                    a.getDoctor().getFullName(),
                    a.getDoctor().getSpecialization(),
                    a.getStatus().getDisplayName(),
                    a.getReason()
            ));
        }
        long completed = list.stream().filter(a -> a.getStatus() == AppointmentStatus.COMPLETED).count();
        Map<String, String> summary = new LinkedHashMap<>();
        summary.put("Total Appointments", String.valueOf(list.size()));
        summary.put("Completed", String.valueOf(completed));
        return new DashboardAndReportDtos.ReportResultDto(
                ReportType.APPOINTMENTS, ReportType.APPOINTMENTS.getTitle(), headers, rows, summary);
    }

    private DashboardAndReportDtos.ReportResultDto buildStatusSummaryReport(LocalDate from, LocalDate to) {
        boolean demoScope = permissionService.isCurrentDemoUser();
        List<AppointmentEntity> list = appointmentRepository.searchAndFilter(
                "", false, AppointmentStatus.SCHEDULED, 0L, 0L, from, to, demoScope, PageRequest.of(0, 2000)).getContent();
        Map<AppointmentStatus, Integer> counts = new EnumMap<>(AppointmentStatus.class);
        for (AppointmentStatus s : AppointmentStatus.values()) counts.put(s, 0);
        for (AppointmentEntity a : list) counts.merge(a.getStatus(), 1, Integer::sum);

        int total = Math.max(1, list.size());
        List<String> headers = List.of("Status", "Count", "Share (%)");
        List<List<String>> rows = new ArrayList<>();
        for (AppointmentStatus s : AppointmentStatus.values()) {
            int c = counts.get(s);
            double pct = list.isEmpty() ? 0.0 : (c * 100.0 / total);
            rows.add(List.of(s.getDisplayName(), String.valueOf(c), String.format(Locale.US, "%.1f%%", pct)));
        }
        Map<String, String> summary = new LinkedHashMap<>();
        summary.put("Total Evaluated", String.valueOf(list.size()));
        summary.put("Active Queue", String.valueOf(counts.get(AppointmentStatus.SCHEDULED) + counts.get(AppointmentStatus.CONFIRMED)));
        return new DashboardAndReportDtos.ReportResultDto(
                ReportType.APPOINTMENT_STATUS, ReportType.APPOINTMENT_STATUS.getTitle(), headers, rows, summary);
    }

    private DashboardAndReportDtos.ReportResultDto buildRevenueReport(String q, LocalDate from, LocalDate to) {
        boolean demoScope = permissionService.isCurrentDemoUser();
        ZoneId appZone = clock.getZone();
        String currencySymbol = settingsService.getCurrentSettingsSnapshot().getCurrencySymbol();
        OffsetDateTime fromTs = from.atStartOfDay(appZone).toOffsetDateTime();
        OffsetDateTime toTs = to.plusDays(1).atStartOfDay(appZone).toOffsetDateTime().minusNanos(1);
        List<BillEntity> bills = billRepository.searchAndFilter(
                q, false, PaymentStatus.PENDING, 0L, fromTs, toTs, demoScope,
                PageRequest.of(0, 2000, Sort.by(Sort.Direction.DESC, "issuedAt"))).getContent();

        List<String> headers = List.of("Invoice #", "Issued Date", "Patient", "Subtotal", "Tax", "Total", "Paid", "Balance", "Status");
        List<List<String>> rows = new ArrayList<>();
        BigDecimal billed = BigDecimal.ZERO;
        BigDecimal collected = BigDecimal.ZERO;
        for (BillEntity b : bills) {
            rows.add(List.of(
                    b.getInvoiceNumber(),
                    b.getIssuedAt().atZoneSameInstant(appZone).toLocalDate().toString(),
                    b.getPatient().getFullName(),
                    DomainValidators.formatCurrency(b.getSubtotal(), currencySymbol),
                    DomainValidators.formatCurrency(b.getTaxAmount(), currencySymbol),
                    DomainValidators.formatCurrency(b.getTotalAmount(), currencySymbol),
                    DomainValidators.formatCurrency(b.getPaidAmount(), currencySymbol),
                    DomainValidators.formatCurrency(b.getBalanceDue(), currencySymbol),
                    b.getPaymentStatus().getDisplayName()
            ));
            if (b.getPaymentStatus() != PaymentStatus.CANCELLED) {
                billed = billed.add(b.getTotalAmount());
                collected = collected.add(b.getPaidAmount());
            }
        }
        Map<String, String> summary = new LinkedHashMap<>();
        summary.put("Invoices Count", String.valueOf(rows.size()));
        summary.put("Total Billed", DomainValidators.formatCurrency(billed, currencySymbol));
        summary.put("Collected", DomainValidators.formatCurrency(collected, currencySymbol));
        summary.put("Outstanding", DomainValidators.formatCurrency(billed.subtract(collected).max(BigDecimal.ZERO), currencySymbol));
        return new DashboardAndReportDtos.ReportResultDto(
                ReportType.REVENUE, ReportType.REVENUE.getTitle(), headers, rows, summary);
    }

    private void appendCsvRow(StringBuilder sb, List<String> cols) {
        for (int i = 0; i < cols.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append(DomainValidators.sanitizeCsvField(cols.get(i)));
        }
        sb.append('\n');
    }
}
