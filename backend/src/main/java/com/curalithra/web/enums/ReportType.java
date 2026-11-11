package com.curalithra.web.enums;

public enum ReportType {
    PATIENT_REGISTRATION("Patient Registration Report"),
    DOCTOR_ACTIVITY("Doctor Activity Report"),
    APPOINTMENTS("Appointment Schedule Report"),
    APPOINTMENT_STATUS("Appointment Status Summary"),
    REVENUE("Billing & Revenue Report");

    private final String title;

    ReportType(String title) {
        this.title = title;
    }

    public String getTitle() {
        return title;
    }
}
