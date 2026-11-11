package com.curalithra.web.dto;

import java.time.OffsetDateTime;
import java.util.List;

public final class CommonDtos {
    private CommonDtos() {}

    public record PagedResponse<T>(
            List<T> content,
            int page,
            int size,
            long totalElements,
            int totalPages,
            boolean first,
            boolean last
    ) {}

    public record ActivityLogDto(
            Long id,
            Long userId,
            String username,
            String actionType,
            String entityType,
            String entityId,
            String summary,
            OffsetDateTime createdAt
    ) {}

    public record NotificationItemDto(
            String id,
            String severity,
            String title,
            String message,
            String route,
            boolean read
    ) {}

    public record NotificationsResponse(
            int totalCount,
            int alertCount,
            int unreadCount,
            List<NotificationItemDto> items
    ) {}

    public record HealthStatusResponse(
            String status,
            String service,
            String version,
            String database,
            String timestamp
    ) {}
}
