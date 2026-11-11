package com.curalithra.web.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "hospital_settings")
public class HospitalSettingsEntity {

    @Id
    private Long id = 1L;

    @Column(name = "hospital_name", nullable = false, length = 160)
    private String hospitalName;

    @Column(nullable = false, length = 240)
    private String tagline;

    @Column(name = "default_tax_rate", nullable = false, precision = 6, scale = 4)
    private BigDecimal defaultTaxRate = new BigDecimal("0.0500");

    @Column(name = "default_appointment_minutes", nullable = false)
    private int defaultAppointmentMinutes = 30;

    @Column(name = "currency_code", nullable = false, length = 10)
    private String currencyCode = "INR";

    @Column(name = "currency_symbol", nullable = false, length = 8)
    private String currencySymbol = "₹";

    @Column(name = "support_email", length = 160)
    private String supportEmail;

    @Column(name = "support_phone", length = 40)
    private String supportPhone;

    @Column(length = 400)
    private String address;

    @Column(name = "invoice_footer_note", length = 400)
    private String invoiceFooterNote;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getHospitalName() { return hospitalName; }
    public void setHospitalName(String hospitalName) { this.hospitalName = hospitalName; }

    public String getTagline() { return tagline; }
    public void setTagline(String tagline) { this.tagline = tagline; }

    public BigDecimal getDefaultTaxRate() { return defaultTaxRate; }
    public void setDefaultTaxRate(BigDecimal defaultTaxRate) { this.defaultTaxRate = defaultTaxRate; }

    public int getDefaultAppointmentMinutes() { return defaultAppointmentMinutes; }
    public void setDefaultAppointmentMinutes(int defaultAppointmentMinutes) { this.defaultAppointmentMinutes = defaultAppointmentMinutes; }

    public String getCurrencyCode() { return currencyCode; }
    public void setCurrencyCode(String currencyCode) { this.currencyCode = currencyCode; }

    public String getCurrencySymbol() { return currencySymbol; }
    public void setCurrencySymbol(String currencySymbol) { this.currencySymbol = currencySymbol; }

    public String getSupportEmail() { return supportEmail; }
    public void setSupportEmail(String supportEmail) { this.supportEmail = supportEmail; }

    public String getSupportPhone() { return supportPhone; }
    public void setSupportPhone(String supportPhone) { this.supportPhone = supportPhone; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getInvoiceFooterNote() { return invoiceFooterNote; }
    public void setInvoiceFooterNote(String invoiceFooterNote) { this.invoiceFooterNote = invoiceFooterNote; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
