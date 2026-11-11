package com.curalithra.web.controller;

import com.curalithra.web.dto.CommonDtos;
import com.curalithra.web.service.NotificationService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public CommonDtos.NotificationsResponse notifications() {
        return notificationService.buildNotifications();
    }

    @PostMapping("/{id}/read")
    public CommonDtos.NotificationsResponse markAsRead(@PathVariable String id) {
        return notificationService.markAsRead(id);
    }

    @PostMapping("/mark-all-read")
    public CommonDtos.NotificationsResponse markAllAsRead() {
        return notificationService.markAllAsRead();
    }
}
