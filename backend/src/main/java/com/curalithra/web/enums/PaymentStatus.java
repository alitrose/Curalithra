package com.curalithra.web.enums;

public enum PaymentStatus {
    PAID("Paid"),
    PENDING("Pending"),
    PARTIALLY_PAID("Partially Paid"),
    CANCELLED("Cancelled");

    private final String displayName;

    PaymentStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
