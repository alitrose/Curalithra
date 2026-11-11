package com.curalithra.web.repository;

import com.curalithra.web.entity.AppointmentEntity;
import com.curalithra.web.enums.AppointmentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AppointmentRepository extends JpaRepository<AppointmentEntity, Long> {

    @EntityGraph(attributePaths = {"patient", "doctor", "doctor.department"})
    Optional<AppointmentEntity> findHydratedById(Long id);

    @EntityGraph(attributePaths = {"patient", "doctor", "doctor.department"})
    @Query("""
            SELECT a FROM AppointmentEntity a
            WHERE (:q = '' OR LOWER(a.appointmentCode) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(a.patient.fullName) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(a.patient.patientCode) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(a.doctor.fullName) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(a.reason) LIKE LOWER(CONCAT('%', :q, '%')))
              AND (:hasStatus = false OR a.status = :status)
              AND (:doctorId = 0L OR a.doctor.id = :doctorId)
              AND (:patientId = 0L OR a.patient.id = :patientId)
              AND a.appointmentDate >= :fromDate
              AND a.appointmentDate <= :toDate
            """)
    Page<AppointmentEntity> searchAndFilter(
            @Param("q") String query,
            @Param("hasStatus") boolean hasStatus,
            @Param("status") AppointmentStatus status,
            @Param("doctorId") long doctorId,
            @Param("patientId") long patientId,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor", "doctor.department"})
    List<AppointmentEntity> findByDoctorIdAndAppointmentDateOrderByAppointmentTimeAsc(Long doctorId, LocalDate appointmentDate);

    @EntityGraph(attributePaths = {"patient", "doctor", "doctor.department"})
    List<AppointmentEntity> findByDoctorIdOrderByAppointmentDateDescAppointmentTimeDesc(Long doctorId);

    @EntityGraph(attributePaths = {"patient", "doctor", "doctor.department"})
    List<AppointmentEntity> findByPatientIdOrderByAppointmentDateDescAppointmentTimeDesc(Long patientId);

    @EntityGraph(attributePaths = {"patient", "doctor", "doctor.department"})
    @Query("""
            SELECT a FROM AppointmentEntity a
            WHERE a.appointmentDate >= :today
              AND a.status IN ('SCHEDULED', 'CONFIRMED')
            ORDER BY a.appointmentDate ASC, a.appointmentTime ASC
            """)
    List<AppointmentEntity> findUpcoming(@Param("today") LocalDate today, Pageable pageable);

    long countByAppointmentDate(LocalDate date);

    long countByStatus(AppointmentStatus status);

    @Query("SELECT COUNT(a) FROM AppointmentEntity a WHERE a.status IN ('SCHEDULED', 'CONFIRMED')")
    long countPendingQueue();

    @Query("SELECT a.status, COUNT(a) FROM AppointmentEntity a GROUP BY a.status")
    List<Object[]> countByStatusGrouped();

    @Query(value = """
            SELECT TO_CHAR(appointment_date, 'YYYY-MM') AS ym, COUNT(*) AS cnt
            FROM appointments
            GROUP BY ym
            ORDER BY ym DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> countAppointmentsByMonth(@Param("limit") int limit);
}
