package com.curalithra.web.service;

import com.curalithra.web.dto.AuthDtos;
import com.curalithra.web.entity.*;
import com.curalithra.web.enums.*;
import com.curalithra.web.exception.AuthorizationException;
import com.curalithra.web.repository.*;
import com.curalithra.web.security.JwtService;
import com.curalithra.web.security.PermissionService;
import com.curalithra.web.util.DtoMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Manages the isolated Public Live Demo workspace (`is_demo = true`).
 * All demo accounts and clinical records are 100% synthetic and strictly segregated
 * from real/production entities. Uses backend-minted JWTs over PostgreSQL.
 */
@Service
public class DemoService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final DoctorRepository doctorRepository;
    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final BillRepository billRepository;
    private final NotificationReadRepository notificationReadRepository;
    private final SequenceRepository sequenceRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final boolean demoEnabled;
    private final String configuredDemoPassword;

    @PersistenceContext
    private EntityManager entityManager;

    public DemoService(UserRepository userRepository,
                       DepartmentRepository departmentRepository,
                       DoctorRepository doctorRepository,
                       PatientRepository patientRepository,
                       AppointmentRepository appointmentRepository,
                       MedicalRecordRepository medicalRecordRepository,
                       BillRepository billRepository,
                       NotificationReadRepository notificationReadRepository,
                       SequenceRepository sequenceRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       PermissionService permissionService,
                       AuditLogService auditLogService,
                       Clock clock,
                       @Value("${curalithra.demo.enabled:false}") boolean demoEnabled,
                       @Value("${curalithra.demo.password:}") String configuredDemoPassword) {
        this.userRepository = userRepository;
        this.departmentRepository = departmentRepository;
        this.doctorRepository = doctorRepository;
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.medicalRecordRepository = medicalRecordRepository;
        this.billRepository = billRepository;
        this.notificationReadRepository = notificationReadRepository;
        this.sequenceRepository = sequenceRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.demoEnabled = demoEnabled;
        this.configuredDemoPassword = configuredDemoPassword;
    }

    public boolean isDemoEnabled() {
        return demoEnabled;
    }

    public AuthDtos.DemoStatusResponse getDemoStatus() {
        if (!demoEnabled) {
            return new AuthDtos.DemoStatusResponse(
                    false,
                    "Public live demo mode is disabled on this server.",
                    List.of()
            );
        }
        return new AuthDtos.DemoStatusResponse(
                true,
                "Explore CURALITHRA in an isolated sandbox populated with 100% synthetic hospital data. Non-destructive demo safety is active.",
                List.of(
                        new AuthDtos.DemoRoleInfoDto(
                                Role.ADMIN,
                                "Administrator Demo",
                                "demo.admin",
                                "Dr. Elena Vance — Medical Director",
                                "Full hospital command center, analytics, scheduling, EMR, billing & audit logs"
                        ),
                        new AuthDtos.DemoRoleInfoDto(
                                Role.DOCTOR,
                                "Doctor Demo",
                                "demo.doctor",
                                "Dr. Evelyn Hayes — Senior Cardiologist",
                                "Clinical schedule, patient charts, medical records & digital prescriptions"
                        ),
                        new AuthDtos.DemoRoleInfoDto(
                                Role.RECEPTIONIST,
                                "Receptionist Demo",
                                "demo.reception",
                                "Maya Lin — Front Desk Coordinator",
                                "Patient intake, conflict-free appointment booking, check-ins & billing desk"
                        )
                )
        );
    }

    @Transactional
    public synchronized void ensureDemoDatasetSeeded() {
        if (!demoEnabled) {
            return;
        }
        ensureDemoDatasetSeededInternal();
    }

    @Transactional
    public synchronized AuthDtos.AuthResponse loginDemoRole(Role role) {
        if (!demoEnabled) {
            throw new AuthorizationException(HttpStatus.FORBIDDEN,
                    "Public demo mode is disabled on this server.");
        }
        if (role == null) {
            throw new AuthorizationException(HttpStatus.BAD_REQUEST, "Demo role is required.");
        }

        ensureDemoDatasetSeededInternal();
        UserEntity demoUser = userRepository.findFirstByRoleAndDemoUserTrueAndActiveTrue(role)
                .orElseGet(() -> {
                    clearDemoRowsOnly();
                    seedFreshDemoWorkspace(null);
                    return userRepository.findFirstByRoleAndDemoUserTrueAndActiveTrue(role)
                            .orElseThrow(() -> new IllegalStateException("Failed to initialize demo user for role " + role));
                });

        demoUser.setLastLoginAt(OffsetDateTime.now(clock));
        UserEntity saved = userRepository.save(demoUser);

        auditLogService.record(saved, "LOGIN", "SESSION", saved.getUsername(),
                "Entered Public Demo Mode as " + saved.getRole().getDisplayName(), true);

        String token = jwtService.generateToken(saved);
        return new AuthDtos.AuthResponse(token, "Bearer", jwtService.getExpirationMs(), DtoMapper.toUserSummary(saved));
    }

    @Transactional
    public synchronized AuthDtos.DemoResetResponse resetDemoDataset() {
        if (!demoEnabled) {
            throw new AuthorizationException(HttpStatus.FORBIDDEN,
                    "Public demo mode is disabled on this server.");
        }
        UserEntity caller = permissionService.requireCurrentUserEntity();
        if (!caller.isDemoUser()) {
            throw new AuthorizationException(HttpStatus.FORBIDDEN,
                    "Demo dataset reset is available only inside Public Demo Mode.");
        }

        Role activeRole = caller.getRole();
        clearDemoRowsOnly();
        seedFreshDemoWorkspace(activeRole);

        UserEntity refreshedUser = userRepository.findFirstByRoleAndDemoUserTrueAndActiveTrue(activeRole)
                .orElseThrow(() -> new IllegalStateException("Demo user missing after reset."));
        refreshedUser.setLastLoginAt(OffsetDateTime.now(clock));
        UserEntity savedCaller = userRepository.save(refreshedUser);

        auditLogService.record(savedCaller, "RESET", "SYSTEM", "DEMO",
                "Reset Public Demo workspace back to clean baseline dataset", true);

        String freshToken = jwtService.generateToken(savedCaller);
        AuthDtos.AuthResponse session = new AuthDtos.AuthResponse(
                freshToken, "Bearer", jwtService.getExpirationMs(), DtoMapper.toUserSummary(savedCaller));

        return new AuthDtos.DemoResetResponse(
                "Public demo dataset restored to baseline (20 patients, 8 doctors, 12 appointments).",
                session,
                patientRepository.countByDemoRecord(true),
                doctorRepository.countByDemoRecord(true),
                appointmentRepository.countByDemoRecord(true)
        );
    }

    private void ensureDemoDatasetSeededInternal() {
        long demoUsers = userRepository.countByDemoUserTrue();
        long demoDoctors = doctorRepository.countByDemoRecord(true);
        long demoPatients = patientRepository.countByDemoRecord(true);
        if (demoUsers >= 3 && demoDoctors >= 8 && demoPatients >= 20) {
            return;
        }
        clearDemoRowsOnly();
        seedFreshDemoWorkspace(null);
    }

    private void clearDemoRowsOnly() {
        notificationReadRepository.deleteAllForDemoUsers();
        entityManager.createNativeQuery("DELETE FROM activity_logs WHERE is_demo = TRUE").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM payments WHERE bill_id IN (SELECT id FROM bills WHERE is_demo = TRUE)").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM bill_items WHERE bill_id IN (SELECT id FROM bills WHERE is_demo = TRUE)").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM bills WHERE is_demo = TRUE").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM prescriptions WHERE is_demo = TRUE").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM medical_records WHERE is_demo = TRUE").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM appointments WHERE is_demo = TRUE").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM patients WHERE is_demo = TRUE").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM users WHERE is_demo = TRUE").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM doctors WHERE is_demo = TRUE").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM departments WHERE is_demo = TRUE").executeUpdate();
        entityManager.flush();
        entityManager.clear();
    }

    private void seedFreshDemoWorkspace(Role triggerRole) {
        ZoneId appZone = clock.getZone();
        OffsetDateTime now = OffsetDateTime.now(clock);
        LocalDate today = LocalDate.now(clock);

        Map<String, DepartmentEntity> depts = seedDemoDepartments(now);

        DoctorEntity d1 = saveDemoDoctor("Dr. Evelyn Hayes", "Cardiology", depts.get("CARD"),
                "+91 98200 41001", "demo.hayes@curalithra.demo", "MD, DM (Cardiology)", 14,
                "Mon-Sat 09:00-17:00", new BigDecimal("850.00"), now);
        DoctorEntity d2 = saveDemoDoctor("Dr. Aarav Nair", "Neurology", depts.get("NEUR"),
                "+91 98200 41002", "demo.nair@curalithra.demo", "MD, DM (Neurology)", 11,
                "Mon-Fri 10:00-18:00", new BigDecimal("900.00"), now);
        DoctorEntity d3 = saveDemoDoctor("Dr. Marcus Vance", "Orthopedics", depts.get("ORTH"),
                "+91 98200 41003", "demo.vance@curalithra.demo", "MS (Orthopedics)", 9,
                "Tue-Sun 09:30-16:30", new BigDecimal("750.00"), now);
        DoctorEntity d4 = saveDemoDoctor("Dr. Priya Kulkarni", "Pediatrics", depts.get("PEDI"),
                "+91 98200 41004", "demo.kulkarni@curalithra.demo", "MD (Pediatrics)", 8,
                "Mon-Sat 08:30-15:30", new BigDecimal("650.00"), now);
        DoctorEntity d5 = saveDemoDoctor("Dr. Elena Rostova", "General Medicine", depts.get("GENM"),
                "+91 98200 41005", "demo.rostova@curalithra.demo", "MD (Internal Medicine)", 12,
                "Mon-Sat 09:00-18:00", new BigDecimal("550.00"), now);
        DoctorEntity d6 = saveDemoDoctor("Dr. Daniel Okafor", "Dermatology", depts.get("DERM"),
                "+91 98200 41006", "demo.okafor@curalithra.demo", "MD (Dermatology)", 7,
                "Mon-Fri 11:00-17:30", new BigDecimal("600.00"), now);
        DoctorEntity d7 = saveDemoDoctor("Dr. Mei-Ling Zhou", "ENT", depts.get("ENT"),
                "+91 98200 41007", "demo.zhou@curalithra.demo", "MS (Otorhinolaryngology)", 10,
                "Mon-Sat 09:30-17:00", new BigDecimal("700.00"), now);
        DoctorEntity d8 = saveDemoDoctor("Dr. Matteo Conti", "Oncology", depts.get("ONCO"),
                "+91 98200 41008", "demo.conti@curalithra.demo", "MD, DM (Medical Oncology)", 16,
                "Mon-Fri 09:00-16:00", new BigDecimal("1100.00"), now);

        String rawSecret = resolveDemoPasswordMaterial();
        String encodedHash = passwordEncoder.encode(rawSecret);

        UserEntity demoAdmin = saveDemoUser("demo.admin", "Dr. Elena Vance", "demo.admin@curalithra.demo",
                encodedHash, Role.ADMIN, null, now);
        saveDemoUser("demo.doctor", "Dr. Evelyn Hayes", "demo.doctor@curalithra.demo",
                encodedHash, Role.DOCTOR, d1.getId(), now);
        saveDemoUser("demo.reception", "Maya Lin (Front Desk)", "demo.reception@curalithra.demo",
                encodedHash, Role.RECEPTIONIST, null, now);

        PatientEntity p1 = saveDemoPatient("Rohan Deshmukh", LocalDate.of(1988, 4, 12), "Male",
                "+91 90100 30001", "rohan.demo@curalithra-demo.example", "14 Lakeview Avenue", "O+",
                "Meera Deshmukh (+91 90100 30901)", "128/82", "104 mg/dL", "76.5", "174",
                regTs(today.minusMonths(4).withDayOfMonth(5), appZone));
        PatientEntity p2 = saveDemoPatient("Clara Bennett", LocalDate.of(1994, 9, 23), "Female",
                "+91 90100 30002", "clara.demo@curalithra-demo.example", "22 Cedar Crescent", "A+",
                "James Bennett (+91 90100 30902)", "116/76", "94 mg/dL", "61.0", "165",
                regTs(today.minusMonths(4).withDayOfMonth(14), appZone));
        PatientEntity p3 = saveDemoPatient("Siddharth Menon", LocalDate.of(1975, 11, 5), "Male",
                "+91 90100 30003", "siddharth.demo@curalithra-demo.example", "88 Parkside Road", "B+",
                "Lakshmi Menon (+91 90100 30903)", "138/88", "142 mg/dL", "82.0", "177",
                regTs(today.minusMonths(4).withDayOfMonth(22), appZone));
        PatientEntity p4 = saveDemoPatient("Hannah Sato", LocalDate.of(2001, 2, 17), "Female",
                "+91 90100 30004", "hannah.demo@curalithra-demo.example", "7 Maple Court", "AB+",
                "Kenji Sato (+91 90100 30904)", "112/72", "88 mg/dL", "55.4", "162",
                regTs(today.minusMonths(3).withDayOfMonth(6), appZone));
        PatientEntity p5 = saveDemoPatient("Vikram Malhotra", LocalDate.of(1968, 7, 30), "Male",
                "+91 90100 30005", "vikram.demo@curalithra-demo.example", "301 Horizon Enclave", "A-",
                "Sunita Malhotra (+91 90100 30905)", "144/90", "156 mg/dL", "84.2", "175",
                regTs(today.minusMonths(3).withDayOfMonth(15), appZone));
        PatientEntity p6 = saveDemoPatient("Nadia Al-Mansoor", LocalDate.of(1990, 12, 3), "Female",
                "+91 90100 30006", "nadia.demo@curalithra-demo.example", "19 Emerald Gardens", "O-",
                "Tariq Al-Mansoor (+91 90100 30906)", "118/78", "96 mg/dL", "63.5", "168",
                regTs(today.minusMonths(3).withDayOfMonth(25), appZone));
        PatientEntity p7 = saveDemoPatient("Arjun Krishnan", LocalDate.of(2016, 6, 14), "Male",
                "+91 90100 30007", "arjun.demo@curalithra-demo.example", "45 Banyan Street", "B+",
                "Divya Krishnan (+91 90100 30907)", "102/68", "86 mg/dL", "31.0", "134",
                regTs(today.minusMonths(2).withDayOfMonth(4), appZone));
        PatientEntity p8 = saveDemoPatient("Sophia Lindqvist", LocalDate.of(1983, 3, 28), "Female",
                "+91 90100 30008", "sophia.demo@curalithra-demo.example", "9 Harbor Terrace", "A+",
                "Erik Lindqvist (+91 90100 30908)", "124/80", "108 mg/dL", "64.8", "170",
                regTs(today.minusMonths(2).withDayOfMonth(12), appZone));
        PatientEntity p9 = saveDemoPatient("Kabir Sen", LocalDate.of(1997, 8, 19), "Male",
                "+91 90100 30009", "kabir.demo@curalithra-demo.example", "64 Riverdale Colony", "O+",
                "Ritu Sen (+91 90100 30909)", "120/78", "92 mg/dL", "71.2", "176",
                regTs(today.minusMonths(2).withDayOfMonth(20), appZone));
        PatientEntity p10 = saveDemoPatient("Ananya Chatterjee", LocalDate.of(1992, 1, 10), "Female",
                "+91 90100 30010", "ananya.demo@curalithra-demo.example", "11 Willow Heights", "B-",
                "Debashish Chatterjee (+91 90100 30910)", "114/74", "91 mg/dL", "58.0", "161",
                regTs(today.minusMonths(2).withDayOfMonth(27), appZone));
        PatientEntity p11 = saveDemoPatient("Lucas Moreau", LocalDate.of(1979, 5, 22), "Male",
                "+91 90100 30011", "lucas.demo@curalithra-demo.example", "53 Oakridge Boulevard", "AB-",
                "Claire Moreau (+91 90100 30911)", "132/84", "118 mg/dL", "79.5", "180",
                regTs(today.minusMonths(1).withDayOfMonth(3), appZone));
        PatientEntity p12 = saveDemoPatient("Zoya Merchant", LocalDate.of(1986, 10, 8), "Female",
                "+91 90100 30012", "zoya.demo@curalithra-demo.example", "27 Silverstone Lane", "O+",
                "Farhan Merchant (+91 90100 30912)", "122/79", "99 mg/dL", "60.4", "164",
                regTs(today.minusMonths(1).withDayOfMonth(9), appZone));
        PatientEntity p13 = saveDemoPatient("Devon Brooks", LocalDate.of(1984, 7, 15), "Male",
                "+91 90100 30013", "devon.demo@curalithra-demo.example", "12 Pineview Row", "A+",
                "Rachel Brooks (+91 90100 30913)", "126/80", "101 mg/dL", "74.0", "178",
                regTs(today.minusMonths(1).withDayOfMonth(16), appZone));
        PatientEntity p14 = saveDemoPatient("Ishita Rao", LocalDate.of(1999, 11, 29), "Female",
                "+91 90100 30014", "ishita.demo@curalithra-demo.example", "404 Magnolia Rise", "O+",
                "Suresh Rao (+91 90100 30914)", "110/70", "89 mg/dL", "54.2", "160",
                regTs(today.minusMonths(1).withDayOfMonth(22), appZone));
        PatientEntity p15 = saveDemoPatient("Gabriel Silva", LocalDate.of(1972, 2, 11), "Male",
                "+91 90100 30015", "gabriel.demo@curalithra-demo.example", "78 Palmcrest Drive", "B+",
                "Elena Silva (+91 90100 30915)", "136/86", "129 mg/dL", "83.5", "179",
                regTs(today.minusMonths(1).withDayOfMonth(26), appZone));
        PatientEntity p16 = saveDemoPatient("Amira Haddad", LocalDate.of(1995, 6, 4), "Female",
                "+91 90100 30016", "amira.demo@curalithra-demo.example", "31 Jasmine Meadows", "A-",
                "Karim Haddad (+91 90100 30916)", "118/74", "95 mg/dL", "59.8", "166",
                regTs(today.minusDays(18), appZone));
        PatientEntity p17 = saveDemoPatient("Nathaniel Park", LocalDate.of(1963, 9, 18), "Male",
                "+91 90100 30017", "nathaniel.demo@curalithra-demo.example", "90 Crestwood Commons", "O-",
                "Grace Park (+91 90100 30917)", "142/88", "134 mg/dL", "77.0", "172",
                regTs(today.minusDays(12), appZone));
        PatientEntity p18 = saveDemoPatient("Leila Farouk", LocalDate.of(2012, 4, 27), "Female",
                "+91 90100 30018", "leila.demo@curalithra-demo.example", "15 Cloverfield Path", "B+",
                "Omar Farouk (+91 90100 30918)", "106/70", "88 mg/dL", "41.5", "146",
                regTs(today.minusDays(7), appZone));
        PatientEntity p19 = saveDemoPatient("Oliver Gallagher", LocalDate.of(1981, 12, 14), "Male",
                "+91 90100 30019", "oliver.demo@curalithra-demo.example", "62 Horizon Square", "AB+",
                "Fiona Gallagher (+91 90100 30919)", "130/82", "110 mg/dL", "80.1", "181",
                regTs(today.minusDays(3), appZone));
        PatientEntity p20 = saveDemoPatient("Tara Bose", LocalDate.of(1991, 3, 21), "Female",
                "+91 90100 30020", "tara.demo@curalithra-demo.example", "5 Lotus Boulevard", "O+",
                "Ranjan Bose (+91 90100 30920)", "116/76", "93 mg/dL", "57.6", "163",
                regTs(today.minusDays(1), appZone));

        AppointmentEntity a1 = saveDemoAppointment(p1, d1, today.minusDays(21), LocalTime.of(9, 30), 30,
                "Annual cardiac screening & ECG review", AppointmentStatus.COMPLETED, "Sinus rhythm normal.", now);
        AppointmentEntity a2 = saveDemoAppointment(p3, d1, today.minusDays(14), LocalTime.of(10, 30), 30,
                "Hypertension medication titration", AppointmentStatus.COMPLETED, "Adjusted morning dosage.", now);
        AppointmentEntity a3 = saveDemoAppointment(p5, d2, today.minusDays(9), LocalTime.of(11, 0), 45,
                "Recurrent migraine evaluation", AppointmentStatus.COMPLETED, "Ordered baseline MRI.", now);
        AppointmentEntity a4 = saveDemoAppointment(p7, d4, today.minusDays(5), LocalTime.of(9, 0), 30,
                "Pediatric immunization & growth check", AppointmentStatus.COMPLETED, "All milestones on track.", now);
        saveDemoAppointment(p8, d3, today.minusDays(3), LocalTime.of(14, 0), 30,
                "Right knee sports strain follow-up", AppointmentStatus.CANCELLED, "Patient requested reschedule.", now);
        saveDemoAppointment(p4, d6, today.minusDays(2), LocalTime.of(15, 30), 30,
                "Seasonal eczema consultation", AppointmentStatus.NO_SHOW, "Patient did not arrive.", now);

        AppointmentEntity a7 = saveDemoAppointment(p2, d5, today, LocalTime.of(9, 30), 30,
                "Post-viral fatigue & vitamin panel review", AppointmentStatus.COMPLETED, "Supplements prescribed.", now);
        AppointmentEntity a8 = saveDemoAppointment(p6, d1, today, LocalTime.of(11, 0), 30,
                "Palpitations & lipid profile follow-up", AppointmentStatus.CONFIRMED, "Fasting lipid panel brought.", now);
        saveDemoAppointment(p9, d3, today, LocalTime.of(14, 30), 30,
                "Lower back ergonomics & posture assessment", AppointmentStatus.SCHEDULED, "Awaiting check-in.", now);
        saveDemoAppointment(p17, d8, today.plusDays(1), LocalTime.of(10, 0), 45,
                "Preventive oncology biomarker consultation", AppointmentStatus.CONFIRMED, "Lab markers uploaded.", now);
        saveDemoAppointment(p18, d7, today.plusDays(2), LocalTime.of(11, 30), 30,
                "Pediatric sinusitis & ENT assessment", AppointmentStatus.SCHEDULED, "First ENT clinic evaluation.", now);
        saveDemoAppointment(p19, d1, today.plusDays(3), LocalTime.of(9, 30), 30,
                "Stress echocardiography clearance", AppointmentStatus.CONFIRMED, "Prepare resting 12-lead ECG.", now);

        saveDemoMedicalRecordWithPrescriptions(p1, d1, a1, today.minusDays(21),
                "Mild exertional dyspnea, occasional fatigue",
                "Borderline Stage 1 Hypertension",
                "Lifestyle sodium reduction, daily 30-min brisk walk, pharmacotherapy",
                "128/82", "98.4 F", "Follow-up ECG clear.",
                List.of(rx("Amlodipine", "5 mg", "Once daily (morning)", 30,
                        "Take after breakfast; log BP twice weekly", PrescriptionStatus.DISPENSED)));

        saveDemoMedicalRecordWithPrescriptions(p3, d1, a2, today.minusDays(14),
                "Elevated morning blood pressure, mild dizziness",
                "Essential Hypertension + Pre-diabetes",
                "Medication optimization and low-glycemic meal plan",
                "138/88", "98.6 F", "Review lipid panel in 6 weeks.",
                List.of(
                        rx("Telmisartan", "40 mg", "Once daily", 30,
                                "Take at consistent morning time", PrescriptionStatus.ACTIVE),
                        rx("Metformin XR", "500 mg", "Once daily with dinner", 30,
                                "Take with evening meal", PrescriptionStatus.ACTIVE)));

        saveDemoMedicalRecordWithPrescriptions(p5, d2, a3, today.minusDays(9),
                "Unilateral throbbing headache, photophobia lasting 6 hours",
                "Migraine without Aura",
                "Acute abortive therapy & sleep hygiene protocol",
                "144/90", "98.2 F", "Maintain trigger diary.",
                List.of(rx("Sumatriptan", "50 mg", "As needed at onset", 15,
                        "Maximum 2 doses per 24 hours", PrescriptionStatus.DISPENSED)));

        saveDemoMedicalRecordWithPrescriptions(p7, d4, a4, today.minusDays(5),
                "Routine school health & immunization checkup",
                "Healthy Pediatric Growth Trajectory",
                "Scheduled vaccine booster & micronutrient nutrition counseling",
                "102/68", "98.4 F", "All growth percentiles normal.",
                List.of(rx("Multivitamin Pediatric Syrup", "5 mL", "Once daily", 30,
                        "Administer after morning meal", PrescriptionStatus.COMPLETED)));

        saveDemoMedicalRecordWithPrescriptions(p2, d5, a7, today,
                "Residual fatigue post-viral URI, mild vitamin D deficiency",
                "Post-Viral Asthenia",
                "Oral hydration, micronutrient repletion, graded activity",
                "116/76", "98.4 F", "Reassess energy levels in 3 weeks.",
                List.of(rx("Cholecalciferol (Vit D3)", "60000 IU", "Once weekly", 56,
                        "Take after Sunday lunch", PrescriptionStatus.ACTIVE)));

        saveDemoMedicalRecordWithPrescriptions(p15, d7, null, today.minusDays(7),
                "Intermittent allergic rhinitis and nasal congestion",
                "Seasonal Allergic Rhinitis",
                "Intranasal corticosteroid spray and allergen avoidance guidance",
                "136/86", "98.3 F", "Review symptom score in 14 days.",
                List.of(
                        rx("Fluticasone Nasal Spray", "50 mcg/spray", "1 spray per nostril once daily", 28,
                                "Use daily for 4 weeks", PrescriptionStatus.ACTIVE),
                        rx("Cetirizine", "10 mg", "Once nightly if symptomatic", 14,
                                "May cause mild drowsiness", PrescriptionStatus.DISPENSED)));

        int year = today.getYear();
        saveDemoBill(year, p1, a1, today.minusMonths(3).withDayOfMonth(15),
                new BigDecimal("1850.00"), new BigDecimal("92.50"), new BigDecimal("1942.50"),
                new BigDecimal("1942.50"), PaymentStatus.PAID, "Cardiology screening package",
                List.of(
                        item("Cardiology Specialist Consultation", "Consultation", 1, new BigDecimal("850.00")),
                        item("12-Lead Digital ECG", "Diagnostics", 1, new BigDecimal("1000.00"))),
                new BigDecimal("1942.50"), PaymentMethod.CARD, "DEMO-CARD-88401", demoAdmin);

        saveDemoBill(year, p3, a2, today.minusMonths(2).withDayOfMonth(18),
                new BigDecimal("2400.00"), new BigDecimal("120.00"), new BigDecimal("2520.00"),
                new BigDecimal("2520.00"), PaymentStatus.PAID, "Hypertension & metabolic lab bundle",
                List.of(
                        item("Cardiology Follow-up Visit", "Consultation", 1, new BigDecimal("850.00")),
                        item("Comprehensive Metabolic & Lipid Panel", "Laboratory", 1, new BigDecimal("1550.00"))),
                new BigDecimal("2520.00"), PaymentMethod.UPI, "DEMO-UPI-99210", demoAdmin);

        saveDemoBill(year, p5, a3, today.minusMonths(1).withDayOfMonth(20),
                new BigDecimal("4400.00"), new BigDecimal("220.00"), new BigDecimal("4620.00"),
                new BigDecimal("3000.00"), PaymentStatus.PARTIALLY_PAID, "Neurology consult & cranial MRI",
                List.of(
                        item("Neurology Specialist Consultation", "Consultation", 1, new BigDecimal("900.00")),
                        item("Cranial MRI Screening", "Radiology", 1, new BigDecimal("3500.00"))),
                new BigDecimal("3000.00"), PaymentMethod.CARD, "DEMO-CARD-90112", demoAdmin);

        saveDemoBill(year, p13, null, today.minusMonths(1).withDayOfMonth(24),
                new BigDecimal("2200.00"), new BigDecimal("110.00"), new BigDecimal("2310.00"),
                new BigDecimal("2310.00"), PaymentStatus.PAID, "Preventive orthopedic & spine evaluation",
                List.of(
                        item("Orthopedics Consultation", "Consultation", 1, new BigDecimal("750.00")),
                        item("Digital Spine X-Ray Series", "Radiology", 1, new BigDecimal("1450.00"))),
                new BigDecimal("2310.00"), PaymentMethod.INSURANCE, "DEMO-INS-33104", demoAdmin);

        saveDemoBill(year, p7, a4, today.minusDays(5),
                new BigDecimal("1350.00"), new BigDecimal("67.50"), new BigDecimal("1417.50"),
                new BigDecimal("1417.50"), PaymentStatus.PAID, "Pediatric immunization visit",
                List.of(
                        item("Pediatrics Consultation", "Consultation", 1, new BigDecimal("650.00")),
                        item("Pediatric Vaccine & Cold-Chain Handling", "Pharmacy", 1, new BigDecimal("700.00"))),
                new BigDecimal("1417.50"), PaymentMethod.UPI, "DEMO-UPI-91005", demoAdmin);

        saveDemoBill(year, p2, a7, today,
                new BigDecimal("1450.00"), new BigDecimal("72.50"), new BigDecimal("1522.50"),
                BigDecimal.ZERO, PaymentStatus.PENDING, "General medicine consult & Vitamin D panel",
                List.of(
                        item("General Medicine Consultation", "Consultation", 1, new BigDecimal("550.00")),
                        item("CBC & 25-OH Vitamin D Assay", "Laboratory", 1, new BigDecimal("900.00"))),
                null, null, null, demoAdmin);

        saveDemoBill(year, p6, a8, today,
                new BigDecimal("1650.00"), new BigDecimal("82.50"), new BigDecimal("1732.50"),
                new BigDecimal("1732.50"), PaymentStatus.PAID, "Cardiology consult & Echocardiogram",
                List.of(
                        item("Cardiology Consultation", "Consultation", 1, new BigDecimal("850.00")),
                        item("Transthoracic Echocardiogram", "Diagnostics", 1, new BigDecimal("800.00"))),
                new BigDecimal("1732.50"), PaymentMethod.BANK_TRANSFER, "DEMO-NEFT-44021", demoAdmin);

        saveDemoBill(year, p8, null, today.minusDays(3),
                new BigDecimal("750.00"), new BigDecimal("37.50"), new BigDecimal("787.50"),
                BigDecimal.ZERO, PaymentStatus.CANCELLED, "Cancelled pre-visit consultation invoice",
                List.of(item("Orthopedics Consultation (Cancelled)", "Consultation", 1, new BigDecimal("750.00"))),
                null, null, null, demoAdmin);

        if (triggerRole == null) {
            auditLogService.record(demoAdmin, "SEED", "SYSTEM", "DEMO",
                    "Initialized Public Demo sandbox (20 patients, 8 doctors, 12 appointments)", true);
        }
    }

    private Map<String, DepartmentEntity> seedDemoDepartments(OffsetDateTime now) {
        String[][] defs = {
                {"Cardiology", "CARD", "Cardiac diagnostics, interventional cardiology, and preventive heart care"},
                {"Neurology", "NEUR", "Brain, spine, and neuromuscular disorders"},
                {"Orthopedics", "ORTH", "Musculoskeletal care, joint trauma, and sports rehabilitation"},
                {"Pediatrics", "PEDI", "Infant, child, and adolescent clinical care"},
                {"General Medicine", "GENM", "Primary internal medicine and chronic care management"},
                {"Dermatology", "DERM", "Clinical dermatology and allergy diagnostics"},
                {"ENT", "ENT", "Ear, nose, throat, and head-neck care"},
                {"Oncology", "ONCO", "Diagnostic oncology and precision therapeutic support"}
        };
        Map<String, DepartmentEntity> map = new HashMap<>();
        for (String[] def : defs) {
            DepartmentEntity dept = new DepartmentEntity();
            dept.setName(def[0]);
            dept.setCode(def[1]);
            dept.setDescription(def[2]);
            dept.setDemoRecord(true);
            dept.setCreatedAt(now);
            DepartmentEntity saved = departmentRepository.save(dept);
            map.put(saved.getCode(), saved);
        }
        return map;
    }

    private DoctorEntity saveDemoDoctor(String fullName, String spec, DepartmentEntity dept, String phone,
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
        d.setDemoRecord(true);
        d.setCreatedAt(now);
        return doctorRepository.save(d);
    }

    private UserEntity saveDemoUser(String username, String fullName, String email, String passwordHash,
                                    Role role, Long linkedDoctorId, OffsetDateTime now) {
        UserEntity u = new UserEntity();
        u.setUsername(username);
        u.setFullName(fullName);
        u.setEmail(email);
        u.setPasswordHash(passwordHash);
        u.setRole(role);
        u.setLinkedDoctorId(linkedDoctorId);
        u.setActive(true);
        u.setDemoUser(true);
        u.setCreatedAt(now);
        return userRepository.save(u);
    }

    private PatientEntity saveDemoPatient(String name, LocalDate dob, String gender, String phone, String email,
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
        p.setDemoRecord(true);
        p.setRegisteredAt(regAt);
        return patientRepository.save(p);
    }

    private AppointmentEntity saveDemoAppointment(PatientEntity patient, DoctorEntity doctor, LocalDate date,
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
        a.setDemoRecord(true);
        a.setCreatedAt(now);
        a.setUpdatedAt(now);
        return appointmentRepository.save(a);
    }

    private PrescriptionEntity rx(String med, String dosage, String freq, int days,
                                  String instructions, PrescriptionStatus status) {
        PrescriptionEntity rx = new PrescriptionEntity();
        rx.setMedicationName(med);
        rx.setDosage(dosage);
        rx.setFrequency(freq);
        rx.setDurationDays(days);
        rx.setInstructions(instructions);
        rx.setStatus(status);
        rx.setDemoRecord(true);
        return rx;
    }

    private void saveDemoMedicalRecordWithPrescriptions(PatientEntity p, DoctorEntity d, AppointmentEntity a,
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
        m.setDemoRecord(true);
        m.setCreatedAt(ts);
        for (PrescriptionEntity rx : rxs) {
            rx.setMedicalRecord(m);
            rx.setPatient(p);
            rx.setDoctor(d);
            rx.setDemoRecord(true);
            rx.setPrescribedAt(ts);
            m.getPrescriptions().add(rx);
        }
        medicalRecordRepository.save(m);
    }

    private BillItemEntity item(String desc, String cat, int qty, BigDecimal unitPrice) {
        BillItemEntity item = new BillItemEntity();
        item.setDescription(desc);
        item.setCategory(cat);
        item.setQuantity(qty);
        item.setUnitPrice(unitPrice);
        item.setLineTotal(unitPrice.multiply(BigDecimal.valueOf(qty)));
        return item;
    }

    private void saveDemoBill(int year, PatientEntity p, AppointmentEntity a, LocalDate issuedDate,
                              BigDecimal subtotal, BigDecimal taxAmount, BigDecimal total, BigDecimal paid,
                              PaymentStatus status, String notes, List<BillItemEntity> items,
                              BigDecimal payAmt, PaymentMethod method, String refNo, UserEntity actor) {
        OffsetDateTime ts = issuedDate.atTime(15, 0).atZone(clock.getZone()).toOffsetDateTime();
        long seq = sequenceRepository.nextInvoiceNumber();
        BillEntity bill = new BillEntity();
        bill.setInvoiceNumber(String.format("INV-%d-%04d", year, seq));
        bill.setDemoRecord(true);
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

    private OffsetDateTime regTs(LocalDate date, ZoneId appZone) {
        return date.atTime(9, 0).atZone(appZone).toOffsetDateTime();
    }

    private String resolveDemoPasswordMaterial() {
        String trimmed = configuredDemoPassword == null ? "" : configuredDemoPassword.trim();
        if (trimmed.length() >= 6) {
            return trimmed;
        }
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
