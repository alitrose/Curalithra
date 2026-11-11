package com.curalithra.web.dto;

import com.curalithra.web.enums.PaymentMethod;
import com.curalithra.web.enums.PaymentStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public final class BillingDtos {
    private BillingDtos() {}

    public record BillItemDto(
            Long id,
            String description,
            String category,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal
    ) {}

    public record BillItemRequest(
            @NotBlank(message = "Service item description is required.")
            @Size(max = 250)
            String description,

            @Size(max = 80)
            String category,

            @Min(value = 1, message = "Item quantity must be at least 1.")
            int quantity,

            @NotNull(message = "Unit price is required.")
            @DecimalMin(value = "0.00", message = "Unit price cannot be negative.")
            BigDecimal unitPrice
    ) {}

    public record PaymentDto(
            Long id,
            BigDecimal amount,
            PaymentMethod paymentMethod,
            String paymentMethodDisplay,
            String referenceNo,
            OffsetDateTime paidAt,
            Long receivedByUserId
    ) {}

    public record CreateBillRequest(
            @NotNull(message = "Patient is required.")
            Long patientId,

            Long appointmentId,

            @NotEmpty(message = "At least one invoice line item is required.")
            @Valid
            List<BillItemRequest> items,

            @DecimalMin(value = "0.00", message = "Tax rate cannot be negative.")
            BigDecimal taxRate,

            @DecimalMin(value = "0.00", message = "Initial payment cannot be negative.")
            BigDecimal initialPaymentAmount,

            PaymentMethod paymentMethod,

            @Size(max = 120)
            String referenceNo,

            String notes
    ) {}

    public record RecordPaymentRequest(
            @NotNull(message = "Payment amount is required.")
            @DecimalMin(value = "0.01", message = "Payment amount must be greater than zero.")
            BigDecimal amount,

            @NotNull(message = "Payment method is required.")
            PaymentMethod paymentMethod,

            @Size(max = 120)
            String referenceNo
    ) {}

    public record BillDto(
            Long id,
            String invoiceNumber,
            Long patientId,
            String patientCode,
            String patientName,
            Long appointmentId,
            String appointmentCode,
            BigDecimal subtotal,
            BigDecimal taxRate,
            BigDecimal taxAmount,
            BigDecimal totalAmount,
            BigDecimal paidAmount,
            BigDecimal balanceDue,
            PaymentStatus paymentStatus,
            String paymentStatusDisplay,
            String notes,
            OffsetDateTime issuedAt,
            OffsetDateTime updatedAt,
            List<BillItemDto> items,
            List<PaymentDto> payments
    ) {}

    public record BillingPageResponse(
            CommonDtos.PagedResponse<BillDto> page,
            BigDecimal totalBilled,
            BigDecimal totalCollected,
            BigDecimal outstandingBalance
    ) {}
}
