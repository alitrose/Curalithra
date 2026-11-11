package com.curalithra.web.enums;

public enum Role {
    ADMIN("Administrator"),
    DOCTOR("Doctor"),
    RECEPTIONIST("Receptionist");

    private final String displayName;

    Role(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
