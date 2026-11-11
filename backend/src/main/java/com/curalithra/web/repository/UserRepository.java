package com.curalithra.web.repository;

import com.curalithra.web.entity.UserEntity;
import com.curalithra.web.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByUsernameIgnoreCase(String username);
    Optional<UserEntity> findByEmailIgnoreCase(String email);
    boolean existsByUsernameIgnoreCase(String username);
    boolean existsByEmailIgnoreCase(String email);
    long countByDemoUserFalse();
    long countByDemoUserTrue();
    List<UserEntity> findByDemoUserOrderByCreatedAtDesc(boolean demoUser);
    Optional<UserEntity> findFirstByRoleAndDemoUserTrueAndActiveTrue(Role role);
}
