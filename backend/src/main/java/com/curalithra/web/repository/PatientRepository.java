package com.curalithra.web.repository;

import com.curalithra.web.entity.PatientEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PatientRepository extends JpaRepository<PatientEntity, Long> {

    Optional<PatientEntity> findByPhoneAndDemoRecord(String phone, boolean demoRecord);

    Optional<PatientEntity> findByPatientCodeIgnoreCase(String patientCode);

    @Query("""
            SELECT p FROM PatientEntity p
            WHERE p.demoRecord = :isDemo
              AND (:q = '' OR LOWER(p.patientCode) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(p.fullName) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(p.phone) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(COALESCE(p.email, '')) LIKE LOWER(CONCAT('%', :q, '%')))
              AND (:gender = '' OR p.gender = :gender)
              AND (:bloodGroup = '' OR p.bloodGroup = :bloodGroup)
            """)
    Page<PatientEntity> searchAndFilter(
            @Param("q") String query,
            @Param("gender") String gender,
            @Param("bloodGroup") String bloodGroup,
            @Param("isDemo") boolean isDemo,
            Pageable pageable);

    List<PatientEntity> findTop6ByDemoRecordOrderByRegisteredAtDesc(boolean demoRecord);

    long countByDemoRecord(boolean demoRecord);

    @Query(value = """
            SELECT TO_CHAR(registered_at AT TIME ZONE :timezone, 'YYYY-MM') AS ym, COUNT(*) AS cnt
            FROM patients
            WHERE is_demo = :isDemo
            GROUP BY ym
            ORDER BY ym DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> countRegistrationsByMonth(
            @Param("isDemo") boolean isDemo,
            @Param("limit") int limit,
            @Param("timezone") String timezone);
}
