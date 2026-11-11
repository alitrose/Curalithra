package com.curalithra.web.service;

import com.curalithra.web.dto.BillingDtos;
import com.curalithra.web.enums.RolePermission;
import com.curalithra.web.security.PermissionService;
import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

@Service
public class InvoicePdfService {

    public record PdfPayload(String invoiceNumber, byte[] content) {}

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final BillingService billingService;
    private final PermissionService permissionService;
    private final SettingsService settingsService;
    private final Clock clock;

    public InvoicePdfService(BillingService billingService,
                             PermissionService permissionService,
                             SettingsService settingsService,
                             Clock clock) {
        this.billingService = billingService;
        this.permissionService = permissionService;
        this.settingsService = settingsService;
        this.clock = clock;
    }

    public PdfPayload generateInvoicePdfPayload(long billId) {
        permissionService.requirePermission(RolePermission.VIEW_BILLING);
        BillingDtos.BillDto bill = billingService.getBill(billId);
        return new PdfPayload(bill.invoiceNumber(), renderPdf(bill));
    }

    public byte[] generateInvoicePdf(long billId) {
        return generateInvoicePdfPayload(billId).content();
    }

    private byte[] renderPdf(BillingDtos.BillDto bill) {
        var settings = settingsService.getCurrentSettingsSnapshot();
        String hospitalTitle = settings.getHospitalName() != null && !settings.getHospitalName().isBlank()
                ? settings.getHospitalName()
                : "CURALITHRA - Intelligent Hospital Management System";
        String currencyCode = settings.getCurrencyCode() != null && !settings.getCurrencyCode().isBlank()
                ? settings.getCurrencyCode()
                : "INR";

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 36, 36, 40, 36);
        PdfWriter.getInstance(doc, out);
        doc.open();

        Font brandFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, new Color(16, 20, 18));
        Font subFont = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(80, 96, 86));
        Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, new Color(40, 122, 89));
        Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);
        Font boldBody = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.BLACK);

        Paragraph title = new Paragraph(hospitalTitle + " (CURALITHRA)", brandFont);
        doc.add(title);
        doc.add(new Paragraph("Care, Connected. Operations, Simplified.  |  Horizon Edition", subFont));
        if (settings.getAddress() != null && !settings.getAddress().isBlank()) {
            doc.add(new Paragraph(settings.getAddress()
                    + (settings.getSupportPhone() != null ? "  |  " + settings.getSupportPhone() : ""), subFont));
        }
        doc.add(Chunk.NEWLINE);

        Paragraph invHeader = new Paragraph("CLINICAL INVOICE #" + bill.invoiceNumber(), sectionFont);
        doc.add(invHeader);
        ZoneId appZone = clock.getZone();
        String zoneLabel = (ZoneOffset.UTC.equals(appZone) || "UTC".equalsIgnoreCase(appZone.getId()))
                ? "UTC"
                : appZone.getId();
        doc.add(new Paragraph("Patient: " + bill.patientName() + " (" + bill.patientCode() + ")", boldBody));
        doc.add(new Paragraph(
                "Issued: " + bill.issuedAt().atZoneSameInstant(appZone).format(DATE_FMT)
                        + " " + zoneLabel + "   |   Status: " + bill.paymentStatusDisplay(),
                bodyFont));
        if (bill.appointmentCode() != null) {
            doc.add(new Paragraph("Linked Appointment: " + bill.appointmentCode(), bodyFont));
        }
        doc.add(Chunk.NEWLINE);

        PdfPTable table = new PdfPTable(new float[]{4.2f, 2.0f, 1.0f, 1.6f, 1.8f});
        table.setWidthPercentage(100);
        addHeaderCell(table, "Description");
        addHeaderCell(table, "Category");
        addHeaderCell(table, "Qty");
        addHeaderCell(table, "Unit Price");
        addHeaderCell(table, "Line Total");

        for (BillingDtos.BillItemDto item : bill.items()) {
            table.addCell(textCell(item.description(), bodyFont, Element.ALIGN_LEFT));
            table.addCell(textCell(item.category(), bodyFont, Element.ALIGN_LEFT));
            table.addCell(textCell(String.valueOf(item.quantity()), bodyFont, Element.ALIGN_RIGHT));
            table.addCell(textCell(fmt(item.unitPrice(), currencyCode), bodyFont, Element.ALIGN_RIGHT));
            table.addCell(textCell(fmt(item.lineTotal(), currencyCode), bodyFont, Element.ALIGN_RIGHT));
        }
        doc.add(table);
        doc.add(Chunk.NEWLINE);

        PdfPTable totals = new PdfPTable(new float[]{3.5f, 1.8f});
        totals.setWidthPercentage(48);
        totals.setHorizontalAlignment(Element.ALIGN_RIGHT);
        addTotalRow(totals, "Subtotal", fmt(bill.subtotal(), currencyCode), bodyFont);
        addTotalRow(totals, "Tax (" + bill.taxRate().multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP) + "%)", fmt(bill.taxAmount(), currencyCode), bodyFont);
        addTotalRow(totals, "Total Amount", fmt(bill.totalAmount(), currencyCode), boldBody);
        addTotalRow(totals, "Paid Amount", fmt(bill.paidAmount(), currencyCode), bodyFont);
        addTotalRow(totals, "Balance Due", fmt(bill.balanceDue(), currencyCode), boldBody);
        doc.add(totals);

        if (!bill.payments().isEmpty()) {
            doc.add(Chunk.NEWLINE);
            doc.add(new Paragraph("Payment History", sectionFont));
            for (BillingDtos.PaymentDto p : bill.payments()) {
                String ref = (p.referenceNo() == null || p.referenceNo().isBlank()) ? "-" : p.referenceNo();
                doc.add(new Paragraph(
                        p.paidAt().atZoneSameInstant(appZone).format(DATE_FMT) + " " + zoneLabel
                                + "  |  " + p.paymentMethodDisplay()
                                + "  |  " + fmt(p.amount(), currencyCode) + "  |  Ref: " + ref,
                        bodyFont));
            }
        }

        if (bill.notes() != null && !bill.notes().isBlank()) {
            doc.add(Chunk.NEWLINE);
            doc.add(new Paragraph("Notes: " + bill.notes(), subFont));
        }
        if (settings.getInvoiceFooterNote() != null && !settings.getInvoiceFooterNote().isBlank()) {
            doc.add(Chunk.NEWLINE);
            doc.add(new Paragraph(settings.getInvoiceFooterNote(), subFont));
        }

        doc.close();
        return out.toByteArray();
    }

    private void addHeaderCell(PdfPTable table, String label) {
        Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, Color.WHITE);
        PdfPCell cell = new PdfPCell(new Phrase(label, headerFont));
        cell.setBackgroundColor(new Color(16, 20, 18));
        cell.setPadding(7f);
        table.addCell(cell);
    }

    private PdfPCell textCell(String text, Font font, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text == null ? "" : text, font));
        cell.setHorizontalAlignment(align);
        cell.setPadding(6f);
        return cell;
    }

    private void addTotalRow(PdfPTable table, String label, String value, Font font) {
        PdfPCell c1 = textCell(label, font, Element.ALIGN_LEFT);
        c1.setBorderColor(new Color(220, 224, 221));
        PdfPCell c2 = textCell(value, font, Element.ALIGN_RIGHT);
        c2.setBorderColor(new Color(220, 224, 221));
        table.addCell(c1);
        table.addCell(c2);
    }

    private String fmt(BigDecimal value, String currencyCode) {
        return currencyCode + " " + (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }
}
