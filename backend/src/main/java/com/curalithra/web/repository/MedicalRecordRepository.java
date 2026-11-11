package com.curalithra.web.repository;

import com.curalithra.web.entity.MedicalRecordEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MedicalRecordRepository extends JpaRepository<MedicalRecordEntity, Long> {

    @EntityGraph(attributePaths = {"patient", "doctor", "doctor.department", "appointment"})
    Optional<MedicalRecordEntity> findHydratedById(Long id);

    @EntityGraph(attributePaths = {"patient", "doctor", "doctor.department", "appointment"})
    @Query("""
            SELECT m FROM MedicalRecordEntity m
            WHERE (:q = '' OR LOWER(m.recordCode) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(m.patient.fullName) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(m.patient.patientCode) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(m.doctor.fullName) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(m.diagnosis) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(m.symptoms) LIKE LOWER(CONCAT('%', :q, '%')))
              AND (:patientId = 0L OR m.patient.id = :patientId)
            """)
    Page<MedicalRecordEntity> searchAndFilter(
            @Param("q") String query,
            @Param("patientId") long patientId,
            Pageable pageable);

    @EntityGraph(attributePaths = {"patient", "doctor", "doctor.department", "appointment"})
    List<MedicalRecordEntity> findByPatientIdOrderByVisitDateDescIdDesc(Long patientId);
}
