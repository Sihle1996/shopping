package com.example.backend.repository;

import com.example.backend.entity.AiAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AiAlertRepository extends JpaRepository<AiAlert, UUID> {
    List<AiAlert> findByTenant_IdAndStatusOrderByCreatedAtDesc(UUID tenantId, String status);
    boolean existsByTenant_IdAndAlertKeyAndStatus(UUID tenantId, String alertKey, String status);
    java.util.Optional<AiAlert> findByIdAndTenant_Id(UUID id, UUID tenantId);
}
