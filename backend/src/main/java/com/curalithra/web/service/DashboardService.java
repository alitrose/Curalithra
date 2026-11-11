package com.curalithra.web.service;

import com.curalithra.web.dto.CommonDtos;
import com.curalithra.web.dto.DashboardAndReportDtos;
import com.curalithra.web.entity.AppointmentEntity;
import com.curalithra.web.entity.BillEntity;
import com.curalithra.web.entity.PatientEntity;
import com.curalithra.web.enums.AppointmentStatus;
import com.curalithra.web.enums.PaymentStatus;
import com.curalithra.web.enums.RolePermission;
import com.curalithra.web.repository.*;
import com.curalithra.web.security.PermissionService;
import com.curalithra.web.util.DtoMapper;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
public class DashboardService {

    private static final LocalDate MIN_DATE = LocalDate.of(1900, 1, 1);
    private static final LocalDate MAX_DATE = LocalDate.of(2999, 12, 31);
    private static final DateTimeFormatter YM_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final BillRepository billRepository;
    private final ActivityLogRepository activityLogRepository;
    private final NotificationService notificationService;
    private final PermissionService permissionService;
    private final Clock clock;

    public DashboardService(PatientRepository patientRepository,
                            DoctorRepository doctorRepository,
                            AppointmentRepository appointmentRepository,
                            BillRepository billRepository,
                            ActivityLogRepository activityLogRepository,
                            NotificationService notificationService,
                            PermissionService permissionService,
                            Clock clock) {
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentRepository = appointmentRepository;
        this.billRepository = billRepository;
        this.activityLogRepository = activityLogRepository;
        this.notificationService = notificationService;
        this.permissionService = permissionService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public DashboardAndReportDtos.DashboardStatsDto loadDashboardStats() {
        return loadDashboardStats(null, null);
    }

    @Transactional(readOnly = true)
    public DashboardAndReportDtos.DashboardStatsDto loadDashboardStats(LocalDate fromDate, LocalDate toDate) {
        permissionService.requirePermission(RolePermission.VIEW_DASHBOARD);

        ZoneId appZone = clock.getZone();
        LocalDate today = LocalDate.now(clock);
        boolean hasDateFilter = fromDate != null || toDate != null;

        long totalPatients;
        long totalDoctors = doctorRepository.countByActiveTrue();
        long todaysAppointments = appointmentRepository.countByAppointmentDate(today);
        long completedAppointments;
        long pendingAppointments;
        long cancelledAppointments;
        BigDecimal totalRevenue;
        BigDecimal collectedRevenue;
        BigDecimal pendingRevenue;
        Map<AppointmentStatus, Long> statusCounts = new EnumMap<>(AppointmentStatus.class);
        for (AppointmentStatus s : AppointmentStatus.values()) {
            statusCounts.put(s, 0L);
        }

        List<DashboardAndReportDtos.MonthlyCountDto> regTrend;
        List<DashboardAndReportDtos.MonthlyCountDto> apptTrend;
        List<DashboardAndReportDtos.MonthlyRevenueDto> revTrend;
        List<PatientEntity> recentPatientsRaw;

        if (!hasDateFilter) {
            totalPatients = patientRepository.count();
            completedAppointments = appointmentRepository.countByStatus(AppointmentStatus.COMPLETED);
            pendingAppointments = appointmentRepository.countPendingQueue();
            for (Object[] row : appointmentRepository.countByStatusGrouped()) {
                AppointmentStatus status = (AppointmentStatus) row[0];
                long count = ((Number) row[1]).longValue();
                statusCounts.put(status, count);
            }
            cancelledAppointments = statusCounts.getOrDefault(AppointmentStatus.CANCELLED, 0L);

            totalRevenue = billRepository.sumTotalBilledRevenue();
            collectedRevenue = billRepository.sumCollectedRevenue();
            pendingRevenue = totalRevenue.subtract(collectedRevenue).max(BigDecimal.ZERO);

            regTrend = toMonthlyCounts(patientRepository.countRegistrationsByMonth(6, appZone.getId()));
            apptTrend = toMonthlyCounts(appointmentRepository.countAppointmentsByMonth(6));

            revTrend = new ArrayList<>();
            for (Object[] row : billRepository.sumMonthlyRevenue(6, appZone.getId())) {
                String month = row[0].toString();
                BigDecimal amount = row[1] instanceof BigDecimal bd ? bd : new BigDecimal(row[1].toString());
                revTrend.add(new DashboardAndReportDtos.MonthlyRevenueDto(month, amount));
            }
            Collections.reverse(revTrend);
            recentPatientsRaw = patientRepository.findTop6ByOrderByRegisteredAtDesc();
        } else {
            LocalDate from = fromDate != null ? fromDate : MIN_DATE;
            LocalDate to = toDate != null ? toDate : MAX_DATE;
            OffsetDateTime fromTs = from.atStartOfDay(appZone).toOffsetDateTime();
            OffsetDateTime toTs = to.plusDays(1).atStartOfDay(appZone).toOffsetDateTime().minusNanos(1);

            List<PatientEntity> allPatients = patientRepository.searchAndFilter(
                    "", "", "", PageRequest.of(0, 2000, Sort.by(Sort.Direction.DESC, "registeredAt"))).getContent();
            List<PatientEntity> filteredPatients = allPatients.stream()
                    .filter(p -> !p.getRegisteredAt().isBefore(fromTs) && !p.getRegisteredAt().isAfter(toTs))
                    .toList();
            totalPatients = filteredPatients.size();
            recentPatientsRaw = filteredPatients.stream().limit(6).toList();

            Map<String, Long> regByMonth = new TreeMap<>();
            for (PatientEntity p : filteredPatients) {
                regByMonth.merge(p.getRegisteredAt().atZoneSameInstant(appZone).format(YM_FMT), 1L, Long::sum);
            }
            regTrend = regByMonth.entrySet().stream()
                    .map(e -> new DashboardAndReportDtos.MonthlyCountDto(e.getKey(), e.getValue()))
                    .toList();

            List<AppointmentEntity> rangeApts = appointmentRepository.searchAndFilter(
                    "", false, AppointmentStatus.SCHEDULED, 0L, 0L, from, to,
                    PageRequest.of(0, 2000, Sort.by(Sort.Direction.ASC, "appointmentDate"))).getContent();
            Map<String, Long> aptByMonth = new TreeMap<>();
            for (AppointmentEntity a : rangeApts) {
                statusCounts.merge(a.getStatus(), 1L, Long::sum);
                aptByMonth.merge(a.getAppointmentDate().format(YM_FMT), 1L, Long::sum);
            }
            completedAppointments = statusCounts.getOrDefault(AppointmentStatus.COMPLETED, 0L);
            pendingAppointments = statusCounts.getOrDefault(AppointmentStatus.SCHEDULED, 0L)
                    + statusCounts.getOrDefault(AppointmentStatus.CONFIRMED, 0L);
            cancelledAppointments = statusCounts.getOrDefault(AppointmentStatus.CANCELLED, 0L);
            apptTrend = aptByMonth.entrySet().stream()
                    .map(e -> new DashboardAndReportDtos.MonthlyCountDto(e.getKey(), e.getValue()))
                    .toList();

            List<BillEntity> rangeBills = billRepository.searchAndFilter(
                    "", false, PaymentStatus.PENDING, 0L, fromTs, toTs,
                    PageRequest.of(0, 2000, Sort.by(Sort.Direction.ASC, "issuedAt"))).getContent();
            BigDecimal billed = BigDecimal.ZERO;
            BigDecimal collected = BigDecimal.ZERO;
            Map<String, BigDecimal> revByMonth = new TreeMap<>();
            for (BillEntity b : rangeBills) {
                if (b.getPaymentStatus() != PaymentStatus.CANCELLED) {
                    billed = billed.add(b.getTotalAmount());
                    collected = collected.add(b.getPaidAmount());
                    revByMonth.merge(b.getIssuedAt().atZoneSameInstant(appZone).format(YM_FMT), b.getTotalAmount(), BigDecimal::add);
                }
            }
            totalRevenue = billed;
            collectedRevenue = collected;
            pendingRevenue = totalRevenue.subtract(collectedRevenue).max(BigDecimal.ZERO);
            revTrend = revByMonth.entrySet().stream()
                    .map(e -> new DashboardAndReportDtos.MonthlyRevenueDto(e.getKey(), e.getValue()))
                    .toList();
        }

        List<DashboardAndReportDtos.StatusCountDto> statusDist = new ArrayList<>();
        for (AppointmentStatus s : AppointmentStatus.values()) {
            statusDist.add(new DashboardAndReportDtos.StatusCountDto(
                    s.name(), s.getDisplayName(), statusCounts.getOrDefault(s, 0L)));
        }

        var upcoming = appointmentRepository.findUpcoming(today, PageRequest.of(0, 6))
                .stream().map(DtoMapper::toAppointmentDto).toList();
        var recentPatients = recentPatientsRaw.stream().map(DtoMapper::toPatientDto).toList();
        List<CommonDtos.ActivityLogDto> recentActivities = permissionService.hasPermission(RolePermission.VIEW_ACTIVITY_LOGS)
                ? activityLogRepository.findTop10ByOrderByCreatedAtDesc().stream().map(DtoMapper::toActivityLogDto).toList()
                : List.of();
        var notifications = notificationService.buildNotifications().items();

        return new DashboardAndReportDtos.DashboardStatsDto(
                totalPatients,
                totalDoctors,
                todaysAppointments,
                completedAppointments,
                pendingAppointments,
                cancelledAppointments,
                totalRevenue,
                collectedRevenue,
                pendingRevenue,
                statusDist,
                regTrend,
                apptTrend,
                revTrend,
                upcoming,
                recentPatients,
                recentActivities,
                notifications
        );
    }

    private List<DashboardAndReportDtos.MonthlyCountDto> toMonthlyCounts(List<Object[]> rows) {
        List<DashboardAndReportDtos.MonthlyCountDto> list = new ArrayList<>();
        for (Object[] row : rows) {
            list.add(new DashboardAndReportDtos.MonthlyCountDto(
                    row[0].toString(), ((Number) row[1]).longValue()));
        }
        Collections.reverse(list);
        return list;
    }
}
