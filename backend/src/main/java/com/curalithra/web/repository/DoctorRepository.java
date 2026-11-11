package com.curalithra.web.repository;

import com.curalithra.web.entity.DoctorEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DoctorRepository extends JpaRepository<DoctorEntity, Long> {

    @EntityGraph(attributePaths = "department")
    Optional<DoctorEntity> findWithDepartmentById(Long id);

    Optional<DoctorEntity> findByEmailIgnoreCase(String email);

    @EntityGraph(attributePaths = "department")
    @Query("""
            SELECT d FROM DoctorEntity d
            WHERE (:q = '' OR LOWER(d.doctorCode) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(d.fullName) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(d.specialization) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(d.department.name) LIKE LOWER(CONCAT('%', :q, '%')))
              AND (:specialization = '' OR LOWER(d.specialization) = LOWER(:specialization))
            """)
    Page<DoctorEntity> searchAndFilter(
            @Param("q") String query,
            @Param("specialization") String specialization,
            Pageable pageable);

    @Query("SELECT DISTINCT d.specialization FROM DoctorEntity d ORDER BY d.specialization ASC")
    List<String> findDistinctSpecializations();

    long countByActiveTrue();
}
