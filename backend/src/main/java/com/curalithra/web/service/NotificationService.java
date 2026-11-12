package com.curalithra.web.service;

import com.curalithra.web.dto.CommonDtos;
import com.curalithra.web.entity.NotificationReadEntity;
import com.curalithra.web.enums.AppointmentStatus;
import com.curalithra.web.enums.PrescriptionStatus;
import com.curalithra.web.enums.RolePermission;
import com.curalithra.web.repository.AppointmentRepository;
import com.curalithra.web.repository.BillRepository;
import com.curalithra.web.repository.DoctorRepository;
import com.curalithra.web.repository.NotificationReadRepository;
import com.curalithra.web.repository.PrescriptionRepository;
import com.curalithra.web.security.CuralithraUserPrincipal;
import com.curalithra.web.security.PermissionService;
import com.curalithra.web.util.DomainValidators;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private final AppointmentRepository appointmentRepository;
    private final BillRepository billRepository;
    private final DoctorRepository doctorRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final NotificationReadRepository notificationReadRepository;
    private final PermissionService permissionService;
    private final SettingsService settingsService;
    private final Clock clock;

    public NotificationService(AppointmentRepository appointmentRepository,
                               BillRepository billRepository,
                               DoctorRepository doctorRepository,
                               PrescriptionRepository prescriptionRepository,
                               NotificationReadRepository notificationReadRepository,
                               PermissionService permissionService,
                               SettingsService settingsService,
                               Clock clock) {
        this.appointmentRepository = appointmentRepository;
        this.billRepository = billRepository;
        this.doctorRepository = doctorRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.notificationReadRepository = notificationReadRepository;
        this.permissionService = permissionService;
        this.settingsService = settingsService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CommonDtos.NotificationsResponse buildNotifications() {
        CuralithraUserPrincipal principal = permissionService.requireAuthenticatedPrincipal();
        boolean demoScope = principal.isDemoUser();
        Set<String> readKeys = notificationReadRepository.findByUserId(principal.getId())
                .stream()
                .map(NotificationReadEntity::getNotificationKey)
                .collect(Collectors.toSet());

        LocalDate today = LocalDate.now(clock);
        List<CommonDtos.NotificationItemDto> items = new ArrayList<>();

        long todaysScheduled = appointmentRepository.findUpcoming(today, demoScope, PageRequest.of(0, 50)).stream()
                .filter(a -> today.equals(a.getAppointmentDate()) && a.getStatus() == AppointmentStatus.SCHEDULED)
                .count();
        if (todaysScheduled > 0) {
            String key = "today-unconfirmed-" + today;
            items.add(new CommonDtos.NotificationItemDto(
                    key,
                    "warning",
                    "Pending Visit Confirmations",
                    todaysScheduled + " scheduled appointment(s) today await patient confirmation.",
                    "/appointments",
                    readKeys.contains(key)
            ));
        }

        long upcomingTotal = appointmentRepository.countPendingQueue(demoScope);
        if (upcomingTotal > 0) {
            String key = "active-queue-" + today;
            items.add(new CommonDtos.NotificationItemDto(
                    key,
                    "info",
                    "Active Clinical Queue",
                    upcomingTotal + " scheduled or confirmed appointment(s) currently in queue.",
                    "/appointments",
                    readKeys.contains(key)
            ));
        }

        if (permissionService.hasPermission(RolePermission.VIEW_MEDICAL_RECORDS)) {
            long activeRx = prescriptionRepository.countByStatusAndDemoRecord(PrescriptionStatus.ACTIVE, demoScope);
            if (activeRx > 0) {
                String key = "active-prescriptions-" + activeRx;
                items.add(new CommonDtos.NotificationItemDto(
                        key,
                        "info",
                        "Active Prescriptions",
                        activeRx + " active prescription(s) awaiting pharmacy dispensing.",
                        "/prescriptions",
                        readKeys.contains(key)
                ));
            }
        }

        if (permissionService.hasPermission(RolePermission.VIEW_BILLING)) {
            long openInvoices = billRepository.countOpenInvoices(demoScope);
            BigDecimal totalBilled = billRepository.sumTotalBilledRevenue(demoScope);
            BigDecimal collected = billRepository.sumCollectedRevenue(demoScope);
            BigDecimal pendingRev = totalBilled.subtract(collected).max(BigDecimal.ZERO);
            if (openInvoices > 0) {
                String currencySymbol = settingsService.getCurrentSettingsSnapshot().getCurrencySymbol();
                String key = "open-invoices-" + openInvoices;
                items.add(new CommonDtos.NotificationItemDto(
                        key,
                        "warning",
                        "Outstanding Receivables",
                        openInvoices + " open invoice(s) with "
                                + DomainValidators.formatCurrency(pendingRev, currencySymbol) + " balance pending.",
                        "/billing",
                        readKeys.contains(key)
                ));
            }
        }

        if (doctorRepository.countByActiveTrueAndDemoRecord(demoScope) == 0) {
            String key = "no-doctors";
            items.add(new CommonDtos.NotificationItemDto(
                    key,
                    "warning",
                    "No Active Doctors",
                    "Register active specialist doctors to enable appointment scheduling.",
                    "/doctors",
                    readKeys.contains(key)
            ));
        }

        if (items.isEmpty()) {
            String key = "all-clear";
            items.add(new CommonDtos.NotificationItemDto(
                    key,
                    "success",
                    "Operations Nominal",
                    "All clinical queues and billing ledgers are balanced.",
                    "/dashboard",
                    readKeys.contains(key)
            ));
        }

        int warningCount = (int) items.stream().filter(i -> !"success".equals(i.severity())).count();
        int unreadCount = (int) items.stream().filter(i -> !i.read()).count();
        return new CommonDtos.NotificationsResponse(items.size(), warningCount, unreadCount, items);
    }

    @Transactional
    public CommonDtos.NotificationsResponse markAsRead(String notificationId) {
        CuralithraUserPrincipal principal = permissionService.requireAuthenticatedPrincipal();
        permissionService.forbidDemoMutation("Modifying notification read state");
        String cleanKey = DomainValidators.requireNonBlank(notificationId, "Notification ID");
        if (cleanKey.length() > 100) {
            cleanKey = cleanKey.substring(0, 100);
        }
        String finalKey = cleanKey;
        if (notificationReadRepository.findByUserIdAndNotificationKey(principal.getId(), finalKey).isEmpty()) {
            NotificationReadEntity entity = new NotificationReadEntity();
            entity.setUserId(principal.getId());
            entity.setNotificationKey(finalKey);
            entity.setReadAt(OffsetDateTime.now(clock));
            notificationReadRepository.save(entity);
        }
        return buildNotifications();
    }

    @Transactional
    public CommonDtos.NotificationsResponse markAllAsRead() {
        CuralithraUserPrincipal principal = permissionService.requireAuthenticatedPrincipal();
        permissionService.forbidDemoMutation("Modifying notification read state");
        CommonDtos.NotificationsResponse current = buildNotifications();
        OffsetDateTime now = OffsetDateTime.now(clock);
        for (CommonDtos.NotificationItemDto item : current.items()) {
            if (!item.read() && notificationReadRepository.findByUserIdAndNotificationKey(principal.getId(), item.id()).isEmpty()) {
                NotificationReadEntity entity = new NotificationReadEntity();
                entity.setUserId(principal.getId());
                entity.setNotificationKey(item.id());
                entity.setReadAt(now);
                notificationReadRepository.save(entity);
            }
        }
        return buildNotifications();
    }
}
