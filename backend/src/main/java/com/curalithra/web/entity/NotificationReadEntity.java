package com.curalithra.web.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "notification_reads", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "notification_key"})
})
public class NotificationReadEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "notification_key", nullable = false, length = 100)
    private String notificationKey;

    @Column(name = "read_at", nullable = false)
    private OffsetDateTime readAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getNotificationKey() { return notificationKey; }
    public void setNotificationKey(String notificationKey) { this.notificationKey = notificationKey; }

    public OffsetDateTime getReadAt() { return readAt; }
    public void setReadAt(OffsetDateTime readAt) { this.readAt = readAt; }
}
