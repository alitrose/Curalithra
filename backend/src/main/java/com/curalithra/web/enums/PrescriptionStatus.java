package com.curalithra.web.enums;

public enum PrescriptionStatus {
    ACTIVE("Active"),
    DISPENSED("Dispensed"),
    COMPLETED("Completed");

    private final String displayName;

    PrescriptionStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
