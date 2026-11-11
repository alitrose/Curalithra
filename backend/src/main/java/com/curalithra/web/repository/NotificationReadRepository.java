package com.curalithra.web.repository;

import com.curalithra.web.entity.NotificationReadEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationReadRepository extends JpaRepository<NotificationReadEntity, Long> {
    List<NotificationReadEntity> findByUserId(Long userId);
    Optional<NotificationReadEntity> findByUserIdAndNotificationKey(Long userId, String notificationKey);
}
