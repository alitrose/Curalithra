package com.curalithra.web.dto;

import com.curalithra.web.enums.ReportType;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public final class DashboardAndReportDtos {
    private DashboardAndReportDtos() {}

    public record MonthlyCountDto(String month, long count) {}

    public record MonthlyRevenueDto(String month, BigDecimal amount) {}

    public record StatusCountDto(String status, String displayName, long count) {}

    public record DashboardStatsDto(
            long totalPatients,
            long totalDoctors,
            long todaysAppointments,
            long completedAppointments,
            long pendingAppointments,
            long cancelledAppointments,
            BigDecimal totalRevenue,
            BigDecimal collectedRevenue,
            BigDecimal pendingRevenue,
            List<StatusCountDto> statusDistribution,
            List<MonthlyCountDto> patientRegistrationTrend,
            List<MonthlyCountDto> appointmentTrend,
            List<MonthlyRevenueDto> monthlyRevenueTrend,
            List<AppointmentDtos.AppointmentDto> upcomingAppointments,
            List<PatientDtos.PatientDto> recentPatients,
            List<CommonDtos.ActivityLogDto> recentActivities,
            List<CommonDtos.NotificationItemDto> notifications
    ) {}

    public record ReportResultDto(
            ReportType type,
            String title,
            List<String> headers,
            List<List<String>> rows,
            Map<String, String> summaryMetrics
    ) {}
}
