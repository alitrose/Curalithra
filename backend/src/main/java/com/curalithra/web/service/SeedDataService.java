package com.curalithra.web.service;

import com.curalithra.web.entity.*;
import com.curalithra.web.enums.*;
import com.curalithra.web.repository.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Seeds 100% synthetic hospital demonstration records on initial workspace setup.
 * Never stores hardcoded plaintext credentials; any optional demo accounts use
 * the passphrase supplied interactively (or via bootstrap env) by the operator.
 */
@Service
public class SeedDataService {

    private final DepartmentRepository departmentRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final BillRepository billRepository;
    private final SequenceRepository sequenceRepository;
    private final AuditLogService auditLogService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public SeedDataService(DepartmentRepository departmentRepository,
                           DoctorRepository doctorRepository,
                           UserRepository userRepository,
                           PatientRepository patientRepository,
                           AppointmentRepository appointmentRepository,
                           MedicalRecordRepository medicalRecordRepository,
                           BillRepository billRepository,
                           SequenceRepository sequenceRepository,
                           AuditLogService auditLogService,
                           PasswordEncoder passwordEncoder,
                           Clock clock) {
        this.departmentRepository = departmentRepository;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.medicalRecordRepository = medicalRecordRepository;
        this.billRepository = billRepository;
        this.sequenceRepository = sequenceRepository;
        this.auditLogService = auditLogService;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    @Transactional
    public Map<String, DepartmentEntity> ensureDefaultDepartments() {
        String[][] defs = {
                {"Cardiology", "CARD", "Cardiac diagnostics, interventional cardiology, and preventive heart care"},
                {"Neurology", "NEUR", "Brain, spine, and neuromuscular disorders"},
                {"Orthopedics", "ORTH", "Musculoskeletal care, joint trauma, and sports rehabilitation"},
                {"Pediatrics", "PEDI", "Infant, child, and adolescent clinical care"},
                {"General Medicine", "GENM", "Primary internal medicine and chronic care management"},
                {"Dermatology", "DERM", "Clinical dermatology and allergy diagnostics"},
                {"ENT", "ENT", "Ear, nose, throat, and head-neck care"}
        };
        OffsetDateTime now = OffsetDateTime.now(clock);
        Map<String, DepartmentEntity> map = new HashMap<>();
        for (String[] def : defs) {
            DepartmentEntity dept = departmentRepository.findByCodeIgnoreCase(def[1])
                    .orElseGet(() -> {
                        DepartmentEntity d = new DepartmentEntity();
                        d.setName(def[0]);
                        d.setCode(def[1]);
                        d.setDescription(def[2]);
                        d.setCreatedAt(now);
                        return departmentRepository.save(d);
                    });
            map.put(dept.getCode(), dept);
        }
        return map;
    }

    @Transactional
    public void seedSyntheticHospitalDataset(UserEntity actor, String demoStaffPassphrase, boolean createSampleRoleAccounts) {
        Map<String, DepartmentEntity> depts = ensureDefaultDepartments();
        if (doctorRepository.count() > 0 || patientRepository.count() > 0) {
            return;
        }

        ZoneId appZone = clock.getZone();
        OffsetDateTime now = OffsetDateTime.now(clock);
        LocalDate today = LocalDate.now(clock);

        DoctorEntity doc1 = createDoctor("Dr. Evelyn Hayes", "Cardiology", depts.get("CARD"),
                "+91 98100 11001", "e.hayes@curalithra.demo", "MD, DM (Cardiology)", 14,
                "Mon-Sat 09:00-17:00", new BigDecimal("850.00"), now);
        DoctorEntity doc2 = createDoctor("Dr. Aarav Nair", "Neurology", depts.get("NEUR"),
                "+91 98100 11002", "a.nair@curalithra.demo", "MD, DM (Neurology)", 11,
                "Mon-Fri 10:00-18:00", new BigDecimal("900.00"), now);
        DoctorEntity doc3 = createDoctor("Dr. Marcus Vance", "Orthopedics", depts.get("ORTH"),
                "+91 98100 11003", "m.vance@curalithra.demo", "MS (Orthopedics)", 9,
                "Tue-Sun 09:30-16:30", new BigDecimal("750.00"), now);
        DoctorEntity doc4 = createDoctor("Dr. Priya Kulkarni", "Pediatrics", depts.get("PEDI"),
                "+91 98100 11004", "p.kulkarni@curalithra.demo", "MD (Pediatrics)", 8,
                "Mon-Sat 08:30-15:30", new BigDecimal("650.00"), now);
        DoctorEntity doc5 = createDoctor("Dr. Elena Rostova", "General Medicine", depts.get("GENM"),
                "+91 98100 11005", "e.rostova@curalithra.demo", "MD (Internal Medicine)", 12,
                "Mon-Sat 09:00-18:00", new BigDecimal("550.00"), now);
        DoctorEntity doc6 = createDoctor("Dr. Daniel Okafor", "Dermatology", depts.get("DERM"),
                "+91 98100 11006", "d.okafor@curalithra.demo", "MD (Dermatology)", 7,
                "Mon-Fri 11:00-17:30", new BigDecimal("600.00"), now);

        if (createSampleRoleAccounts && demoStaffPassphrase != null && demoStaffPassphrase.length() >= 6) {
            createUserIfAbsent("doctor.demo", "Dr. Evelyn Hayes", "e.hayes@curalithra.demo",
                    passwordEncoder.encode(demoStaffPassphrase), Role.DOCTOR, doc1.getId(), now);
            createUserIfAbsent("reception.demo", "Maya Lin (Front Desk)", "reception@curalithra.demo",
                    passwordEncoder.encode(demoStaffPassphrase), Role.RECEPTIONIST, null, now);
        }

        PatientEntity p1 = createPatient("Rohan Deshmukh", LocalDate.of(1988, 4, 12), "Male",
                "+91 90001 20001", "rohan.d@example.org", "14 Lakeview Avenue", "O+",
                "Meera Deshmukh (+91 90001 20099)", "128/82", "104 mg/dL", "76.5", "174",
                today.minusMonths(4).withDayOfMonth(8).atTime(9, 0).atZone(appZone).toOffsetDateTime());
        PatientEntity p2 = createPatient("Clara Bennett", LocalDate.of(1994, 9, 23), "Female",
                "+91 90001 20002", "clara.b@example.org", "22 Cedar Crescent", "A+",
                "James Bennett (+91 90001 20098)", "116/76", "94 mg/dL", "61.0", "165",
                today.minusMonths(4).withDayOfMonth(19).atTime(9, 0).atZone(appZone).toOffsetDateTime());
        PatientEntity p3 = createPatient("Siddharth Menon", LocalDate.of(1975, 11, 5), "Male",
                "+91 90001 20003", "s.menon@example.org", "88 Parkside Road", "B+",
                "Lakshmi Menon (+91 90001 20097)", "138/88", "142 mg/dL", "82.0", "177",
                today.minusMonths(3).withDayOfMonth(6).atTime(9, 0).atZone(appZone).toOffsetDateTime());
        PatientEntity p4 = createPatient("Hannah Sato", LocalDate.of(2001, 2, 17), "Female",
                "+91 90001 20004", "hannah.s@example.org", "7 Maple Court", "AB+",
                "Kenji Sato (+91 90001 20096)", "112/72", "88 mg/dL", "55.4", "162",
                today.minusMonths(3).withDayOfMonth(21).atTime(9, 0).atZone(appZone).toOffsetDateTime());
        PatientEntity p5 = createPatient("Vikram Malhotra", LocalDate.of(1968, 7, 30), "Male",
                "+91 90001 20005", "vikram.m@example.org", "301 Horizon Enclave", "A-",
                "Sunita Malhotra (+91 90001 20095)", "144/90", "156 mg/dL", "84.2", "175",
                today.minusMonths(2).withDayOfMonth(4).atTime(9, 0).atZone(appZone).toOffsetDateTime());
        PatientEntity p6 = createPatient("Nadia Al-Mansoor", LocalDate.of(1990, 12, 3), "Female",
                "+91 90001 20006", "nadia.am@example.org", "19 Emerald Gardens", "O-",
                "Tariq Al-Mansoor (+91 90001 20094)", "118/78", "96 mg/dL", "63.5", "168",
                today.minusMonths(2).withDayOfMonth(18).atTime(9, 0).atZone(appZone).toOffsetDateTime());
        PatientEntity p7 = createPatient("Arjun Krishnan", LocalDate.of(2016, 6, 14), "Male",
                "+91 90001 20007", "krishnan.family@example.org", "45 Banyan Street", "B+",
                "Divya Krishnan (+91 90001 20093)", "102/68", "86 mg/dL", "31.0", "134",
                today.minusMonths(1).withDayOfMonth(7).atTime(9, 0).atZone(appZone).toOffsetDateTime());
        PatientEntity p8 = createPatient("Sophia Lindqvist", LocalDate.of(1983, 3, 28), "Female",
                "+91 90001 20008", "sophia.l@example.org", "9 Harbor Terrace", "A+",
                "Erik Lindqvist (+91 90001 20092)", "124/80", "108 mg/dL", "64.8", "170",
                today.minusMonths(1).withDayOfMonth(15).atTime(9, 0).atZone(appZone).toOffsetDateTime());
        PatientEntity p9 = createPatient("Kabir Sen", LocalDate.of(1997, 8, 19), "Male",
                "+91 90001 20009", "kabir.sen@example.org", "64 Riverdale Colony", "O+",
                "Ritu Sen (+91 90001 20091)", "120/78", "92 mg/dL", "71.2", "176",
                today.minusMonths(1).withDayOfMonth(25).atTime(9, 0).atZone(appZone).toOffsetDateTime());
        PatientEntity p10 = createPatient("Ananya Chatterjee", LocalDate.of(1992, 1, 10), "Female",
                "+91 90001 20010", "ananya.c@example.org", "11 Willow Heights", "B-",
                "Debashish Chatterjee (+91 90001 20090)", "114/74", "91 mg/dL", "58.0", "161",
                today.minusDays(10).atTime(9, 0).atZone(appZone).toOffsetDateTime());
        PatientEntity p11 = createPatient("Lucas Moreau", LocalDate.of(1979, 5, 22), "Male",
                "+91 90001 20011", "lucas.m@example.org", "53 Oakridge Boulevard", "AB-",
                "Claire Moreau (+91 90001 20089)", "132/84", "118 mg/dL", "79.5", "180",
                today.minusDays(4).atTime(9, 0).atZone(appZone).toOffsetDateTime());
        PatientEntity p12 = createPatient("Zoya Merchant", LocalDate.of(1986, 10, 8), "Female",
                "+91 90001 20012", "zoya.m@example.org", "27 Silverstone Lane", "O+",
                "Farhan Merchant (+91 90001 20088)", "122/79", "99 mg/dL", "60.4", "164",
                today.minusDays(1).atTime(9, 0).atZone(appZone).toOffsetDateTime());

        AppointmentEntity a1 = createAppointment(p1, doc1, today.minusDays(22), LocalTime.of(9, 30), 30,
                "Annual cardiac screening & ECG review", AppointmentStatus.COMPLETED, "Sinus rhythm normal.", now);
        AppointmentEntity a2 = createAppointment(p3, doc1, today.minusDays(14), LocalTime.of(10, 30), 30,
                "Hypertension medication titration", AppointmentStatus.COMPLETED, "Adjusted morning dosage.", now);
        AppointmentEntity a3 = createAppointment(p5, doc2, today.minusDays(9), LocalTime.of(11, 0), 45,
                "Recurrent migraine evaluation", AppointmentStatus.COMPLETED, "Ordered baseline MRI.", now);
        AppointmentEntity a4 = createAppointment(p7, doc4, today.minusDays(5), LocalTime.of(9, 0), 30,
                "Pediatric immunization & growth check", AppointmentStatus.COMPLETED, "All milestones on track.", now);
        createAppointment(p8, doc3, today.minusDays(3), LocalTime.of(14, 0), 30,
                "Right knee sports strain follow-up", AppointmentStatus.CANCELLED, "Patient rescheduled.", now);
        createAppointment(p4, doc6, today.minusDays(2), LocalTime.of(15, 30), 30,
                "Seasonal eczema consultation", AppointmentStatus.NO_SHOW, "Patient did not arrive.", now);
        AppointmentEntity a7 = createAppointment(p2, doc5, today, LocalTime.of(9, 30), 30,
                "Post-viral fatigue & blood panel review", AppointmentStatus.COMPLETED, "Vitamins prescribed.", now);
        AppointmentEntity a8 = createAppointment(p6, doc1, today, LocalTime.of(11, 0), 30,
                "Palpitations & lipid profile follow-up", AppointmentStatus.CONFIRMED, "Fasting lipid panel brought.", now);
        createAppointment(p9, doc3, today, LocalTime.of(14, 30), 30,
                "Lower back ergonomics & posture assessment", AppointmentStatus.SCHEDULED, "First orthopedic visit.", now);
        createAppointment(p10, doc5, today, LocalTime.of(16, 0), 30,
                "Routine preventive health checkup", AppointmentStatus.CONFIRMED, "Vitals triage pending.", now);
        createAppointment(p11, doc2, today.plusDays(1), LocalTime.of(10, 0), 30,
                "Neuropathy follow-up consultation", AppointmentStatus.CONFIRMED, "Review nerve conduction report.", now);
        createAppointment(p12, doc6, today.plusDays(2), LocalTime.of(12, 0), 30,
                "Dermatology patch allergy test", AppointmentStatus.SCHEDULED, "Avoid antihistamines 48h prior.", now);
        createAppointment(p1, doc1, today.plusDays(3), LocalTime.of(9, 30), 30,
                "Six-month echocardiography check", AppointmentStatus.SCHEDULED, "", now);
        createAppointment(p5, doc5, today.plusDays(5), LocalTime.of(15, 0), 30,
                "Glycemic control & HbA1c follow-up", AppointmentStatus.CONFIRMED, "", now);

        createMedicalRecordWithPrescriptions(p1, doc1, a1, today.minusDays(22),
                "Mild exertional dyspnea, occasional fatigue",
                "Borderline Stage 1 Hypertension",
                "Lifestyle sodium reduction, daily 30-min brisk walk, pharmacotherapy",
                "128/82", "98.4 F", "Follow-up ECG clear.",
                List.of(rxTemplate("Amlodipine", "5 mg", "Once daily (morning)", 30,
                        "Take after breakfast; monitor BP twice weekly", PrescriptionStatus.DISPENSED)));

        createMedicalRecordWithPrescriptions(p3, doc1, a2, today.minusDays(14),
                "Elevated morning blood pressure, mild dizziness",
                "Essential Hypertension + Pre-diabetes",
                "Medication optimization and low-glycemic meal plan",
                "138/88", "98.6 F", "Review lipid panel in 6 weeks.",
                List.of(
                        rxTemplate("Telmisartan", "40 mg", "Once daily", 30,
                                "Take at consistent morning time", PrescriptionStatus.ACTIVE),
                        rxTemplate("Metformin XR", "500 mg", "Once daily with dinner", 30,
                                "Take with evening meal to minimize GI discomfort", PrescriptionStatus.ACTIVE)));

        createMedicalRecordWithPrescriptions(p5, doc2, a3, today.minusDays(9),
                "Unilateral throbbing headache, photophobia lasting 6 hours",
                "Migraine without Aura",
                "Acute abortive therapy & sleep hygiene protocol",
                "144/90", "98.2 F", "Maintain trigger diary.",
                List.of(rxTemplate("Sumatriptan", "50 mg", "As needed at onset", 15,
                        "Do not exceed 2 doses in 24 hours", PrescriptionStatus.DISPENSED)));

        createMedicalRecordWithPrescriptions(p2, doc5, a7, today,
                "Residual fatigue post-viral URI, mild vitamin D deficiency",
                "Post-Viral Asthenia",
                "Oral hydration, micronutrient repletion, graded activity",
                "116/76", "98.4 F", "Reassess energy levels in 3 weeks.",
                List.of(rxTemplate("Cholecalciferol (Vit D3)", "60000 IU", "Once weekly", 56,
                        "Take after Sunday lunch", PrescriptionStatus.ACTIVE)));

        int y = today.getYear();
        createBill(y, p1, a1, today.minusMonths(3).withDayOfMonth(15),
                new BigDecimal("1850.00"), new BigDecimal("92.50"), new BigDecimal("1942.50"),
                new BigDecimal("1942.50"), PaymentStatus.PAID, "Cardiology screening package",
                List.of(
                        itemTemplate("Cardiology Specialist Consultation", "Consultation", 1, new BigDecimal("850.00")),
                        itemTemplate("12-Lead Digital ECG", "Diagnostics", 1, new BigDecimal("1000.00"))),
                new BigDecimal("1942.50"), PaymentMethod.CARD, "TXN-88401", actor);

        createBill(y, p3, a2, today.minusMonths(2).withDayOfMonth(18),
                new BigDecimal("2400.00"), new BigDecimal("120.00"), new BigDecimal("2520.00"),
                new BigDecimal("2520.00"), PaymentStatus.PAID, "Hypertension & metabolic lab bundle",
                List.of(
                        itemTemplate("Cardiology Follow-up Visit", "Consultation", 1, new BigDecimal("850.00")),
                        itemTemplate("Comprehensive Metabolic & Lipid Panel", "Laboratory", 1, new BigDecimal("1550.00"))),
                new BigDecimal("2520.00"), PaymentMethod.UPI, "UPI-99210", actor);

        createBill(y, p5, a3, today.minusMonths(1).withDayOfMonth(20),
                new BigDecimal("4400.00"), new BigDecimal("220.00"), new BigDecimal("4620.00"),
                new BigDecimal("3000.00"), PaymentStatus.PARTIALLY_PAID, "Neurology consult & diagnostic imaging",
                List.of(
                        itemTemplate("Neurology Specialist Consultation", "Consultation", 1, new BigDecimal("900.00")),
                        itemTemplate("Cranial MRI Screening", "Radiology", 1, new BigDecimal("3500.00"))),
                new BigDecimal("3000.00"), PaymentMethod.CARD, "TXN-90112", actor);

        createBill(y, p7, a4, today.minusDays(5),
                new BigDecimal("1350.00"), new BigDecimal("67.50"), new BigDecimal("1417.50"),
                new BigDecimal("1417.50"), PaymentStatus.PAID, "Pediatric immunization visit",
                List.of(
                        itemTemplate("Pediatrics Consultation", "Consultation", 1, new BigDecimal("650.00")),
                        itemTemplate("Pediatric Vaccine & Cold-Chain Handling", "Pharmacy", 1, new BigDecimal("700.00"))),
                new BigDecimal("1417.50"), PaymentMethod.UPI, "UPI-91005", actor);

        createBill(y, p2, a7, today,
                new BigDecimal("1450.00"), new BigDecimal("72.50"), new BigDecimal("1522.50"),
                BigDecimal.ZERO, PaymentStatus.PENDING, "General medicine consult & Vitamin D panel",
                List.of(
                        itemTemplate("General Medicine Consultation", "Consultation", 1, new BigDecimal("550.00")),
                        itemTemplate("CBC & 25-OH Vitamin D Assay", "Laboratory", 1, new BigDecimal("900.00"))),
                null, null, null, actor);

        createBill(y, p6, a8, today,
                new BigDecimal("1650.00"), new BigDecimal("82.50"), new BigDecimal("1732.50"),
                new BigDecimal("1732.50"), PaymentStatus.PAID, "Pre-paid cardiology consult & Echo screening",
                List.of(
                        itemTemplate("Cardiology Consultation", "Consultation", 1, new BigDecimal("850.00")),
                        itemTemplate("Transthoracic Echocardiogram", "Diagnostics", 1, new BigDecimal("800.00"))),
                new BigDecimal("1732.50"), PaymentMethod.BANK_TRANSFER, "NEFT-44021", actor);

        auditLogService.record(actor, "SEED", "SYSTEM", "DEMO",
                "Initialized synthetic CURALITHRA Web demonstration dataset");
    }

    private DoctorEntity createDoctor(String fullName, String spec, DepartmentEntity dept, String phone,
                                      String email, String qual, int exp, String avail, BigDecimal fee, OffsetDateTime now) {
        DoctorEntity d = new DoctorEntity();
        d.setDoctorCode("DOC-" + sequenceRepository.nextDoctorNumber());
        d.setFullName(fullName);
        d.setSpecialization(spec);
        d.setDepartment(dept);
        d.setPhone(phone);
        d.setEmail(email);
        d.setQualification(qual);
        d.setExperienceYears(exp);
        d.setAvailabilitySchedule(avail);
        d.setConsultationFee(fee);
        d.setActive(true);
        d.setCreatedAt(now);
        return doctorRepository.save(d);
    }

    private void createUserIfAbsent(String username, String fullName, String email, String hash,
                                    Role role, Long linkedDoctorId, OffsetDateTime now) {
        if (userRepository.existsByUsernameIgnoreCase(username)) return;
        UserEntity u = new UserEntity();
        u.setUsername(username);
        u.setFullName(fullName);
        u.setEmail(email);
        u.setPasswordHash(hash);
        u.setRole(role);
        u.setLinkedDoctorId(linkedDoctorId);
        u.setActive(true);
        u.setCreatedAt(now);
        userRepository.save(u);
    }

    private PatientEntity createPatient(String name, LocalDate dob, String gender, String phone, String email,
                                        String address, String bloodGroup, String emergency, String bp,
                                        String sugar, String wt, String ht, OffsetDateTime regAt) {
        PatientEntity p = new PatientEntity();
        p.setPatientCode("PAT-" + sequenceRepository.nextPatientNumber());
        p.setFullName(name);
        p.setDateOfBirth(dob);
        p.setGender(gender);
        p.setPhone(phone);
        p.setEmail(email);
        p.setAddress(address);
        p.setBloodGroup(bloodGroup);
        p.setEmergencyContact(emergency);
        p.setBp(bp);
        p.setSugar(sugar);
        p.setWeightKg(wt);
        p.setHeightCm(ht);
        p.setRegisteredAt(regAt);
        return patientRepository.save(p);
    }

    private AppointmentEntity createAppointment(PatientEntity patient, DoctorEntity doctor, LocalDate date,
                                                LocalTime time, int duration, String reason,
                                                AppointmentStatus status, String notes, OffsetDateTime now) {
        AppointmentEntity a = new AppointmentEntity();
        a.setAppointmentCode("APT-" + sequenceRepository.nextAppointmentNumber());
        a.setPatient(patient);
        a.setDoctor(doctor);
        a.setAppointmentDate(date);
        a.setAppointmentTime(time);
        a.setDurationMinutes(duration);
        a.setReason(reason);
        a.setStatus(status);
        a.setNotes(notes);
        a.setCreatedAt(now);
        a.setUpdatedAt(now);
        return appointmentRepository.save(a);
    }

    private PrescriptionEntity rxTemplate(String med, String dosage, String freq, int days,
                                          String instructions, PrescriptionStatus status) {
        PrescriptionEntity rx = new PrescriptionEntity();
        rx.setMedicationName(med);
        rx.setDosage(dosage);
        rx.setFrequency(freq);
        rx.setDurationDays(days);
        rx.setInstructions(instructions);
        rx.setStatus(status);
        return rx;
    }

    private void createMedicalRecordWithPrescriptions(PatientEntity p, DoctorEntity d, AppointmentEntity a,
                                                      LocalDate visitDate, String symptoms, String diagnosis,
                                                      String treatment, String bp, String temp, String notes,
                                                      List<PrescriptionEntity> rxs) {
        OffsetDateTime ts = visitDate.atTime(11, 30).atZone(clock.getZone()).toOffsetDateTime();
        MedicalRecordEntity m = new MedicalRecordEntity();
        m.setRecordCode("REC-" + sequenceRepository.nextMedicalRecordNumber());
        m.setPatient(p);
        m.setDoctor(d);
        m.setAppointment(a);
        m.setVisitDate(visitDate);
        m.setSymptoms(symptoms);
        m.setDiagnosis(diagnosis);
        m.setTreatment(treatment);
        m.setVitalsBp(bp);
        m.setVitalsTemp(temp);
        m.setNotes(notes);
        m.setCreatedAt(ts);
        for (PrescriptionEntity rx : rxs) {
            rx.setMedicalRecord(m);
            rx.setPatient(p);
            rx.setDoctor(d);
            rx.setPrescribedAt(ts);
            m.getPrescriptions().add(rx);
        }
        medicalRecordRepository.save(m);
    }

    private BillItemEntity itemTemplate(String desc, String cat, int qty, BigDecimal unitPrice) {
        BillItemEntity item = new BillItemEntity();
        item.setDescription(desc);
        item.setCategory(cat);
        item.setQuantity(qty);
        item.setUnitPrice(unitPrice);
        item.setLineTotal(unitPrice.multiply(BigDecimal.valueOf(qty)));
        return item;
    }

    private void createBill(int year, PatientEntity p, AppointmentEntity a, LocalDate issuedDate,
                            BigDecimal subtotal, BigDecimal taxAmount, BigDecimal total, BigDecimal paid,
                            PaymentStatus status, String notes, List<BillItemEntity> items,
                            BigDecimal payAmt, PaymentMethod method, String refNo, UserEntity actor) {
        OffsetDateTime ts = issuedDate.atTime(15, 0).atZone(clock.getZone()).toOffsetDateTime();
        long seq = sequenceRepository.nextInvoiceNumber();
        BillEntity bill = new BillEntity();
        bill.setInvoiceNumber(String.format("INV-%d-%04d", year, seq));
        bill.setPatient(p);
        bill.setAppointment(a);
        bill.setSubtotal(subtotal);
        bill.setTaxRate(new BigDecimal("0.0500"));
        bill.setTaxAmount(taxAmount);
        bill.setTotalAmount(total);
        bill.setPaidAmount(paid);
        bill.setPaymentStatus(status);
        bill.setNotes(notes);
        bill.setIssuedAt(ts);
        bill.setUpdatedAt(ts);
        for (BillItemEntity item : items) {
            item.setBill(bill);
            bill.getItems().add(item);
        }
        if (payAmt != null && method != null) {
            PaymentEntity pay = new PaymentEntity();
            pay.setBill(bill);
            pay.setAmount(payAmt);
            pay.setPaymentMethod(method);
            pay.setReferenceNo(refNo);
            pay.setPaidAt(ts.plusMinutes(10));
            pay.setReceivedByUserId(actor != null ? actor.getId() : null);
            bill.getPayments().add(pay);
        }
        billRepository.save(bill);
    }
}
