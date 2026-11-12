package com.curalithra.web.service;

import com.curalithra.web.dto.BillingDtos;
import com.curalithra.web.dto.CommonDtos;
import com.curalithra.web.entity.*;
import com.curalithra.web.enums.PaymentMethod;
import com.curalithra.web.enums.PaymentStatus;
import com.curalithra.web.enums.RolePermission;
import com.curalithra.web.exception.NotFoundException;
import com.curalithra.web.exception.ValidationException;
import com.curalithra.web.repository.AppointmentRepository;
import com.curalithra.web.repository.BillRepository;
import com.curalithra.web.repository.PatientRepository;
import com.curalithra.web.repository.SequenceRepository;
import com.curalithra.web.security.PermissionService;
import com.curalithra.web.util.DomainValidators;
import com.curalithra.web.util.DtoMapper;
import com.curalithra.web.util.PaginationUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

@Service
public class BillingService {

    public record BillingCalculation(BigDecimal subtotal, BigDecimal taxRate, BigDecimal taxAmount, BigDecimal totalAmount) {}

    private static final OffsetDateTime MIN_TS = OffsetDateTime.of(1900, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC);
    private static final OffsetDateTime MAX_TS = OffsetDateTime.of(2999, 12, 31, 23, 59, 59, 0, ZoneOffset.UTC);
    private static final Map<String, String> ALLOWED_SORTS = Map.of(
            "issuedAt", "issuedAt",
            "invoiceNumber", "invoiceNumber",
            "totalAmount", "totalAmount",
            "paymentStatus", "paymentStatus"
    );

    private final BillRepository billRepository;
    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final SequenceRepository sequenceRepository;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final SettingsService settingsService;
    private final BigDecimal defaultTaxRate;
    private final Clock clock;

    public BillingService(BillRepository billRepository,
                          PatientRepository patientRepository,
                          AppointmentRepository appointmentRepository,
                          SequenceRepository sequenceRepository,
                          PermissionService permissionService,
                          AuditLogService auditLogService,
                          SettingsService settingsService,
                          Clock clock,
                          @Value("${curalithra.app.default-tax-rate:0.0500}") BigDecimal defaultTaxRate) {
        this.billRepository = billRepository;
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.sequenceRepository = sequenceRepository;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.settingsService = settingsService;
        this.clock = clock;
        this.defaultTaxRate = defaultTaxRate;
    }

    @Transactional(readOnly = true)
    public BillingDtos.BillingPageResponse searchBills(
            String query, PaymentStatus status, Long patientId,
            LocalDate fromDate, LocalDate toDate, int page, int size, String sortBy, String sortDir) {
        permissionService.requirePermission(RolePermission.VIEW_BILLING);
        boolean demoScope = permissionService.isCurrentDemoUser();
        String cleanQuery = DomainValidators.optionalTrimmed(query);
        ZoneId appZone = clock.getZone();
        OffsetDateTime fromTs = fromDate != null ? fromDate.atStartOfDay(appZone).toOffsetDateTime() : MIN_TS;
        OffsetDateTime toTs = toDate != null ? toDate.plusDays(1).atStartOfDay(appZone).toOffsetDateTime().minusNanos(1) : MAX_TS;
        Pageable pageable = PaginationUtils.createPageable(page, size, sortBy, sortDir, ALLOWED_SORTS, "issuedAt");

        Page<BillEntity> result = billRepository.searchAndFilter(
                cleanQuery,
                status != null,
                status != null ? status : PaymentStatus.PENDING,
                patientId != null ? patientId : 0L,
                fromTs,
                toTs,
                demoScope,
                pageable);

        result.getContent().forEach(b -> {
            b.getItems().size();
            b.getPayments().size();
        });

        BigDecimal totalBilled = billRepository.sumTotalBilledRevenue(demoScope);
        BigDecimal totalCollected = billRepository.sumCollectedRevenue(demoScope);
        BigDecimal outstanding = totalBilled.subtract(totalCollected).max(BigDecimal.ZERO);

        return new BillingDtos.BillingPageResponse(
                PaginationUtils.toPagedResponse(result, DtoMapper::toBillDto),
                totalBilled,
                totalCollected,
                outstanding
        );
    }

    @Transactional(readOnly = true)
    public BillingDtos.BillDto getBill(long id) {
        permissionService.requirePermission(RolePermission.VIEW_BILLING);
        BillEntity bill = billRepository.findHydratedById(id)
                .orElseThrow(() -> new NotFoundException("Invoice not found."));
        permissionService.verifySameScope(bill.isDemoRecord(), "Invoice");
        bill.getItems().size();
        bill.getPayments().size();
        return DtoMapper.toBillDto(bill);
    }

    public BillingCalculation calculateTotals(List<BillingDtos.BillItemRequest> items, BigDecimal requestedTaxRate) {
        if (items == null || items.isEmpty()) {
            throw new ValidationException("At least one service charge item is required.");
        }
        BigDecimal resolvedDefault = settingsService != null ? settingsService.resolveDefaultTaxRate() : defaultTaxRate;
        BigDecimal effectiveRate = requestedTaxRate == null ? resolvedDefault : requestedTaxRate;
        DomainValidators.validateNonNegativeAmount(effectiveRate, "Tax rate");

        BigDecimal subtotal = BigDecimal.ZERO;
        for (BillingDtos.BillItemRequest item : items) {
            DomainValidators.requireNonBlank(item.description(), "Service item description");
            if (item.quantity() <= 0) {
                throw new ValidationException("Item quantity must be greater than zero.");
            }
            BigDecimal unit = DomainValidators.validateNonNegativeAmount(item.unitPrice(), "Unit price")
                    .setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = unit.multiply(BigDecimal.valueOf(item.quantity())).setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(lineTotal);
        }
        subtotal = subtotal.setScale(2, RoundingMode.HALF_UP);
        BigDecimal taxAmount = subtotal.multiply(effectiveRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.add(taxAmount).setScale(2, RoundingMode.HALF_UP);
        return new BillingCalculation(subtotal, effectiveRate.setScale(4, RoundingMode.HALF_UP), taxAmount, total);
    }

    @Transactional
    public BillingDtos.BillDto createBill(BillingDtos.CreateBillRequest req) {
        permissionService.requirePermission(RolePermission.MANAGE_BILLING);
        permissionService.forbidDemoMutation("Creating invoices");
        UserEntity actor = permissionService.requireCurrentUserEntity();
        boolean demoScope = actor.isDemoUser();

        PatientEntity patient = patientRepository.findById(req.patientId())
                .orElseThrow(() -> new NotFoundException("Selected patient does not exist."));
        permissionService.verifySameScope(patient.isDemoRecord(), "Selected patient");
        AppointmentEntity appointment = null;
        if (req.appointmentId() != null) {
            appointment = appointmentRepository.findById(req.appointmentId())
                    .orElseThrow(() -> new NotFoundException("Selected appointment does not exist."));
            permissionService.verifySameScope(appointment.isDemoRecord(), "Selected appointment");
        }

        BillingCalculation calc = calculateTotals(req.items(), req.taxRate());
        BigDecimal paid = req.initialPaymentAmount() == null
                ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                : DomainValidators.validateNonNegativeAmount(req.initialPaymentAmount(), "Initial payment")
                        .setScale(2, RoundingMode.HALF_UP);

        if (paid.compareTo(calc.totalAmount()) > 0) {
            throw new ValidationException("Initial payment cannot exceed invoice total (" + calc.totalAmount() + ").");
        }

        PaymentStatus status;
        if (paid.compareTo(calc.totalAmount()) == 0 && calc.totalAmount().compareTo(BigDecimal.ZERO) > 0) {
            status = PaymentStatus.PAID;
        } else if (paid.compareTo(BigDecimal.ZERO) > 0) {
            status = PaymentStatus.PARTIALLY_PAID;
        } else if (calc.totalAmount().compareTo(BigDecimal.ZERO) == 0) {
            status = PaymentStatus.PAID;
        } else {
            status = PaymentStatus.PENDING;
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        long seq = sequenceRepository.nextInvoiceNumber();

        BillEntity bill = new BillEntity();
        bill.setInvoiceNumber(String.format("INV-%d-%04d", LocalDate.now(clock).getYear(), seq));
        bill.setDemoRecord(demoScope);
        bill.setPatient(patient);
        bill.setAppointment(appointment);
        bill.setSubtotal(calc.subtotal());
        bill.setTaxRate(calc.taxRate());
        bill.setTaxAmount(calc.taxAmount());
        bill.setTotalAmount(calc.totalAmount());
        bill.setPaidAmount(paid);
        bill.setPaymentStatus(status);
        bill.setNotes(DomainValidators.optionalTrimmed(req.notes()));
        bill.setIssuedAt(now);
        bill.setUpdatedAt(now);

        for (BillingDtos.BillItemRequest itemReq : req.items()) {
            BigDecimal unit = itemReq.unitPrice().setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = unit.multiply(BigDecimal.valueOf(itemReq.quantity())).setScale(2, RoundingMode.HALF_UP);
            BillItemEntity item = new BillItemEntity();
            item.setBill(bill);
            item.setDescription(DomainValidators.requireNonBlank(itemReq.description(), "Service item description"));
            String cat = DomainValidators.optionalTrimmed(itemReq.category());
            item.setCategory(cat.isEmpty() ? "General" : cat);
            item.setQuantity(itemReq.quantity());
            item.setUnitPrice(unit);
            item.setLineTotal(lineTotal);
            bill.getItems().add(item);
        }

        if (paid.compareTo(BigDecimal.ZERO) > 0) {
            PaymentEntity pay = new PaymentEntity();
            pay.setBill(bill);
            pay.setAmount(paid);
            pay.setPaymentMethod(req.paymentMethod() == null ? PaymentMethod.CASH : req.paymentMethod());
            pay.setReferenceNo(DomainValidators.optionalTrimmed(req.referenceNo()));
            pay.setPaidAt(now);
            pay.setReceivedByUserId(actor.getId());
            bill.getPayments().add(pay);
        }

        BillEntity saved = billRepository.save(bill);
        auditLogService.record(actor, "CREATE", "BILL", saved.getInvoiceNumber(),
                "Issued invoice for " + patient.getFullName() + " total " + saved.getTotalAmount());
        return DtoMapper.toBillDto(saved);
    }

    @Transactional
    public BillingDtos.BillDto recordPayment(long billId, BillingDtos.RecordPaymentRequest req) {
        permissionService.requirePermission(RolePermission.MANAGE_BILLING);
        permissionService.forbidDemoMutation("Recording payments");
        UserEntity actor = permissionService.requireCurrentUserEntity();

        BillEntity bill = billRepository.findHydratedById(billId)
                .orElseThrow(() -> new NotFoundException("Invoice not found."));
        permissionService.verifySameScope(bill.isDemoRecord(), "Invoice");
        bill.getItems().size();
        bill.getPayments().size();

        if (bill.getPaymentStatus() == PaymentStatus.CANCELLED) {
            throw new ValidationException("Cannot record payment on a cancelled invoice.");
        }
        if (bill.getPaymentStatus() == PaymentStatus.PAID) {
            throw new ValidationException("Invoice " + bill.getInvoiceNumber() + " is already fully paid.");
        }

        BigDecimal cleanAmount = DomainValidators.validatePositiveAmount(req.amount(), "Payment amount")
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal balance = bill.getBalanceDue();
        if (cleanAmount.compareTo(balance) > 0) {
            throw new ValidationException("Payment exceeds outstanding balance due (" + balance + ").");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        PaymentEntity payment = new PaymentEntity();
        payment.setBill(bill);
        payment.setAmount(cleanAmount);
        payment.setPaymentMethod(req.paymentMethod());
        payment.setReferenceNo(DomainValidators.optionalTrimmed(req.referenceNo()));
        payment.setPaidAt(now);
        payment.setReceivedByUserId(actor.getId());
        bill.getPayments().add(payment);

        BigDecimal newPaid = bill.getPaidAmount().add(cleanAmount).setScale(2, RoundingMode.HALF_UP);
        bill.setPaidAmount(newPaid);
        bill.setPaymentStatus(newPaid.compareTo(bill.getTotalAmount()) >= 0
                ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID);
        bill.setUpdatedAt(now);

        BillEntity saved = billRepository.save(bill);
        auditLogService.record(actor, "PAYMENT", "BILL", saved.getInvoiceNumber(),
                "Recorded payment of " + cleanAmount + " via " + req.paymentMethod().getDisplayName());
        return DtoMapper.toBillDto(saved);
    }

    @Transactional
    public BillingDtos.BillDto cancelBill(long billId) {
        permissionService.requirePermission(RolePermission.MANAGE_BILLING);
        permissionService.forbidDemoMutation("Cancelling invoices");
        UserEntity actor = permissionService.requireCurrentUserEntity();

        BillEntity bill = billRepository.findHydratedById(billId)
                .orElseThrow(() -> new NotFoundException("Invoice not found."));
        permissionService.verifySameScope(bill.isDemoRecord(), "Invoice");
        bill.getItems().size();
        bill.getPayments().size();

        if (bill.getPaidAmount().compareTo(BigDecimal.ZERO) > 0) {
            throw new ValidationException("Cannot cancel an invoice that already has recorded payments.");
        }
        bill.setPaymentStatus(PaymentStatus.CANCELLED);
        bill.setUpdatedAt(OffsetDateTime.now(clock));

        BillEntity saved = billRepository.save(bill);
        auditLogService.record(actor, "CANCEL", "BILL", saved.getInvoiceNumber(),
                "Cancelled invoice " + saved.getInvoiceNumber());
        return DtoMapper.toBillDto(saved);
    }

    @Transactional
    public void deleteBill(long billId) {
        permissionService.requirePermission(RolePermission.DELETE_BILLING);
        permissionService.forbidDemoMutation("Deleting invoices");
        UserEntity actor = permissionService.requireCurrentUserEntity();

        BillEntity bill = billRepository.findById(billId)
                .orElseThrow(() -> new NotFoundException("Invoice not found."));
        permissionService.verifySameScope(bill.isDemoRecord(), "Invoice");
        billRepository.delete(bill);
        billRepository.flush();

        auditLogService.record(actor, "DELETE", "BILL", bill.getInvoiceNumber(),
                "Deleted invoice " + bill.getInvoiceNumber());
    }
}
