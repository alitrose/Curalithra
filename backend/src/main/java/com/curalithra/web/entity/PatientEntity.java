package com.curalithra.web.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "patients")
public class PatientEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "patient_code", nullable = false, unique = true, length = 32)
    private String patientCode;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Column(nullable = false, length = 16)
    private String gender;

    @Column(nullable = false, length = 30)
    private String phone;

    @Column(length = 160)
    private String email;

    @Column(length = 500)
    private String address;

    @Column(name = "blood_group", nullable = false, length = 16)
    private String bloodGroup;

    @Column(name = "emergency_contact", length = 200)
    private String emergencyContact;

    @Column(length = 40)
    private String bp;

    @Column(length = 40)
    private String sugar;

    @Column(name = "weight_kg", length = 40)
    private String weightKg;

    @Column(name = "height_cm", length = 40)
    private String heightCm;

    @Column(name = "registered_at", nullable = false)
    private OffsetDateTime registeredAt;

    @Column(name = "is_demo", nullable = false)
    private boolean demoRecord = false;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getPatientCode() { return patientCode; }
    public void setPatientCode(String patientCode) { this.patientCode = patientCode; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getBloodGroup() { return bloodGroup; }
    public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }

    public String getEmergencyContact() { return emergencyContact; }
    public void setEmergencyContact(String emergencyContact) { this.emergencyContact = emergencyContact; }

    public String getBp() { return bp; }
    public void setBp(String bp) { this.bp = bp; }

    public String getSugar() { return sugar; }
    public void setSugar(String sugar) { this.sugar = sugar; }

    public String getWeightKg() { return weightKg; }
    public void setWeightKg(String weightKg) { this.weightKg = weightKg; }

    public String getHeightCm() { return heightCm; }
    public void setHeightCm(String heightCm) { this.heightCm = heightCm; }

    public OffsetDateTime getRegisteredAt() { return registeredAt; }
    public void setRegisteredAt(OffsetDateTime registeredAt) { this.registeredAt = registeredAt; }

    public boolean isDemoRecord() { return demoRecord; }
    public void setDemoRecord(boolean demoRecord) { this.demoRecord = demoRecord; }
}
