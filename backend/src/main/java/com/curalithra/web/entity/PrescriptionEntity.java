package com.curalithra.web.entity;

import com.curalithra.web.enums.PrescriptionStatus;
import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "prescriptions")
public class PrescriptionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "medical_record_id", nullable = false)
    private MedicalRecordEntity medicalRecord;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "patient_id", nullable = false)
    private PatientEntity patient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false)
    private DoctorEntity doctor;

    @Column(name = "medication_name", nullable = false, length = 200)
    private String medicationName;

    @Column(nullable = false, length = 100)
    private String dosage;

    @Column(nullable = false, length = 120)
    private String frequency;

    @Column(name = "duration_days", nullable = false)
    private int durationDays;

    @Column(length = 500)
    private String instructions;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private PrescriptionStatus status = PrescriptionStatus.ACTIVE;

    @Column(name = "prescribed_at", nullable = false)
    private OffsetDateTime prescribedAt;

    @Column(name = "is_demo", nullable = false)
    private boolean demoRecord = false;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public MedicalRecordEntity getMedicalRecord() { return medicalRecord; }
    public void setMedicalRecord(MedicalRecordEntity medicalRecord) { this.medicalRecord = medicalRecord; }

    public PatientEntity getPatient() { return patient; }
    public void setPatient(PatientEntity patient) { this.patient = patient; }

    public DoctorEntity getDoctor() { return doctor; }
    public void setDoctor(DoctorEntity doctor) { this.doctor = doctor; }

    public String getMedicationName() { return medicationName; }
    public void setMedicationName(String medicationName) { this.medicationName = medicationName; }

    public String getDosage() { return dosage; }
    public void setDosage(String dosage) { this.dosage = dosage; }

    public String getFrequency() { return frequency; }
    public void setFrequency(String frequency) { this.frequency = frequency; }

    public int getDurationDays() { return durationDays; }
    public void setDurationDays(int durationDays) { this.durationDays = durationDays; }

    public String getInstructions() { return instructions; }
    public void setInstructions(String instructions) { this.instructions = instructions; }

    public PrescriptionStatus getStatus() { return status; }
    public void setStatus(PrescriptionStatus status) { this.status = status; }

    public OffsetDateTime getPrescribedAt() { return prescribedAt; }
    public void setPrescribedAt(OffsetDateTime prescribedAt) { this.prescribedAt = prescribedAt; }

    public boolean isDemoRecord() { return demoRecord; }
    public void setDemoRecord(boolean demoRecord) { this.demoRecord = demoRecord; }
}
