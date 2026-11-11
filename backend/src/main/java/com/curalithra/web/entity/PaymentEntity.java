package com.curalithra.web.entity;

import com.curalithra.web.enums.PaymentMethod;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "payments")
public class PaymentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bill_id", nullable = false)
    private BillEntity bill;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 24)
    private PaymentMethod paymentMethod;

    @Column(name = "reference_no", length = 120)
    private String referenceNo;

    @Column(name = "paid_at", nullable = false)
    private OffsetDateTime paidAt;

    @Column(name = "received_by")
    private Long receivedByUserId;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public BillEntity getBill() { return bill; }
    public void setBill(BillEntity bill) { this.bill = bill; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public PaymentMethod getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(PaymentMethod paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getReferenceNo() { return referenceNo; }
    public void setReferenceNo(String referenceNo) { this.referenceNo = referenceNo; }

    public OffsetDateTime getPaidAt() { return paidAt; }
    public void setPaidAt(OffsetDateTime paidAt) { this.paidAt = paidAt; }

    public Long getReceivedByUserId() { return receivedByUserId; }
    public void setReceivedByUserId(Long receivedByUserId) { this.receivedByUserId = receivedByUserId; }
}
