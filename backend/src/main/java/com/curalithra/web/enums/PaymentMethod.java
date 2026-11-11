package com.curalithra.web.enums;

public enum PaymentMethod {
    CASH("Cash"),
    CARD("Card"),
    UPI("UPI"),
    BANK_TRANSFER("Bank Transfer"),
    INSURANCE("Insurance");

    private final String displayName;

    PaymentMethod(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
