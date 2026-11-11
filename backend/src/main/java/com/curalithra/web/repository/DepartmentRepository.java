package com.curalithra.web.repository;

import com.curalithra.web.entity.DepartmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DepartmentRepository extends JpaRepository<DepartmentEntity, Long> {
    Optional<DepartmentEntity> findByCodeIgnoreCaseAndDemoRecord(String code, boolean demoRecord);
    List<DepartmentEntity> findByDemoRecordOrderByNameAsc(boolean demoRecord);
    long countByDemoRecord(boolean demoRecord);
}
