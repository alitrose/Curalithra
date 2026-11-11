package com.curalithra.web.controller;

import com.curalithra.web.dto.BillingDtos;
import com.curalithra.web.enums.PaymentStatus;
import com.curalithra.web.service.BillingService;
import com.curalithra.web.service.InvoicePdfService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/billing")
public class BillingController {

    private final BillingService billingService;
    private final InvoicePdfService invoicePdfService;

    public BillingController(BillingService billingService, InvoicePdfService invoicePdfService) {
        this.billingService = billingService;
        this.invoicePdfService = invoicePdfService;
    }

    @GetMapping
    public BillingDtos.BillingPageResponse listBills(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) Long patientId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "issuedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        return billingService.searchBills(query, status, patientId, fromDate, toDate, page, size, sortBy, sortDir);
    }

    @GetMapping("/{id}")
    public BillingDtos.BillDto getBill(@PathVariable long id) {
        return billingService.getBill(id);
    }

    @PostMapping
    public ResponseEntity<BillingDtos.BillDto> createBill(@Valid @RequestBody BillingDtos.CreateBillRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(billingService.createBill(req));
    }

    @PostMapping("/{id}/payments")
    public BillingDtos.BillDto recordPayment(
            @PathVariable long id,
            @Valid @RequestBody BillingDtos.RecordPaymentRequest req) {
        return billingService.recordPayment(id, req);
    }

    @PostMapping("/{id}/cancel")
    public BillingDtos.BillDto cancelBill(@PathVariable long id) {
        return billingService.cancelBill(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBill(@PathVariable long id) {
        billingService.deleteBill(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> downloadPdf(@PathVariable long id) {
        InvoicePdfService.PdfPayload payload = invoicePdfService.generateInvoicePdfPayload(id);
        String safeCode = payload.invoiceNumber().replaceAll("[^A-Za-z0-9_-]", "");
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename("CURALITHRA-" + safeCode + ".pdf", StandardCharsets.UTF_8)
                .build());
        return ResponseEntity.ok().headers(headers).body(payload.content());
    }
}
