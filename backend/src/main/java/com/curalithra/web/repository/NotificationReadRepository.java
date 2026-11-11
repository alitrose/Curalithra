package com.curalithra.web.repository;

import com.curalithra.web.entity.NotificationReadEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface NotificationReadRepository extends JpaRepository<NotificationReadEntity, Long> {
    List<NotificationReadEntity> findByUserId(Long userId);
    Optional<NotificationReadEntity> findByUserIdAndNotificationKey(Long userId, String notificationKey);

    @Modifying
    @Query("DELETE FROM NotificationReadEntity nr WHERE nr.userId IN (SELECT u.id FROM UserEntity u WHERE u.demoUser = true)")
    void deleteAllForDemoUsers();
}
