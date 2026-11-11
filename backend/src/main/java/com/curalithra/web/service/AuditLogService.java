package com.curalithra.web.service;

import com.curalithra.web.dto.CommonDtos;
import com.curalithra.web.entity.ActivityLogEntity;
import com.curalithra.web.entity.UserEntity;
import com.curalithra.web.enums.RolePermission;
import com.curalithra.web.repository.ActivityLogRepository;
import com.curalithra.web.security.PermissionService;
import com.curalithra.web.util.DtoMapper;
import com.curalithra.web.util.PaginationUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Map;

@Service
public class AuditLogService {

    private final ActivityLogRepository activityLogRepository;
    private final PermissionService permissionService;
    private final Clock clock;

    public AuditLogService(ActivityLogRepository activityLogRepository,
                           PermissionService permissionService,
                           Clock clock) {
        this.activityLogRepository = activityLogRepository;
        this.permissionService = permissionService;
        this.clock = clock;
    }

    @Transactional
    public void record(UserEntity actor, String actionType, String entityType, String entityId, String summary) {
        ActivityLogEntity entry = new ActivityLogEntity();
        entry.setUserId(actor != null ? actor.getId() : null);
        entry.setUsername(actor != null ? actor.getUsername() : "system");
        entry.setActionType(actionType);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setSummary(summary);
        entry.setCreatedAt(OffsetDateTime.now(clock));
        activityLogRepository.save(entry);
    }

    @Transactional(readOnly = true)
    public CommonDtos.PagedResponse<CommonDtos.ActivityLogDto> listAuditLogs(int page, int size) {
        permissionService.requirePermission(RolePermission.VIEW_ACTIVITY_LOGS);
        Pageable pageable = PaginationUtils.createPageable(
                page, size, "createdAt", "desc",
                Map.of("createdAt", "createdAt", "actionType", "actionType"), "createdAt");
        Page<ActivityLogEntity> logs = activityLogRepository.findAllByOrderByCreatedAtDesc(pageable);
        return PaginationUtils.toPagedResponse(logs, DtoMapper::toActivityLogDto);
    }
}
