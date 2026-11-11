package com.curalithra.web.repository;

import com.curalithra.web.entity.PrescriptionEntity;
import com.curalithra.web.enums.PrescriptionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PrescriptionRepository extends JpaRepository<PrescriptionEntity, Long> {

    @EntityGraph(attributePaths = {"patient", "doctor", "medicalRecord"})
    Optional<PrescriptionEntity> findHydratedById(Long id);

    @EntityGraph(attributePaths = {"patient", "doctor", "medicalRecord"})
    @Query("""
            SELECT rx FROM PrescriptionEntity rx
            WHERE (:q = '' OR LOWER(rx.medicationName) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(rx.patient.fullName) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(rx.patient.patientCode) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(rx.doctor.fullName) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(rx.medicalRecord.recordCode) LIKE LOWER(CONCAT('%', :q, '%')))
              AND (:hasStatus = false OR rx.status = :status)
              AND (:patientId = 0L OR rx.patient.id = :patientId)
              AND (:recordId = 0L OR rx.medicalRecord.id = :recordId)
            """)
    Page<PrescriptionEntity> searchByFilters(
            @Param("q") String query,
            @Param("hasStatus") boolean hasStatus,
            @Param("status") PrescriptionStatus status,
            @Param("patientId") long patientId,
            @Param("recordId") long recordId,
            Pageable pageable);

    long countByStatus(PrescriptionStatus status);
}
