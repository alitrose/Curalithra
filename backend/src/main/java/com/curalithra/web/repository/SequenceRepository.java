package com.curalithra.web.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

@Repository
public class SequenceRepository {

    @PersistenceContext
    private EntityManager entityManager;

    public long nextPatientNumber() {
        return nextVal("seq_patient_code");
    }

    public long nextDoctorNumber() {
        return nextVal("seq_doctor_code");
    }

    public long nextAppointmentNumber() {
        return nextVal("seq_appointment_code");
    }

    public long nextMedicalRecordNumber() {
        return nextVal("seq_record_code");
    }

    public long nextInvoiceNumber() {
        return nextVal("seq_invoice_seq");
    }

    private long nextVal(String sequenceName) {
        Object result = entityManager.createNativeQuery("SELECT nextval('" + sequenceName + "')").getSingleResult();
        return ((Number) result).longValue();
    }
}
