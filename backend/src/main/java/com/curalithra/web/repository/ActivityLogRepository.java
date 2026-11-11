package com.curalithra.web.repository;

import com.curalithra.web.entity.ActivityLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActivityLogRepository extends JpaRepository<ActivityLogEntity, Long> {
    Page<ActivityLogEntity> findByDemoRecordOrderByCreatedAtDesc(boolean demoRecord, Pageable pageable);
    List<ActivityLogEntity> findTop10ByDemoRecordOrderByCreatedAtDesc(boolean demoRecord);
}
