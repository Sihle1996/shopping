package com.example.backend.repository;

import com.example.backend.entity.AiAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AiAlertRepository extends JpaRepository<AiAlert, UUID> {
    List<AiAlert> findByTenant_IdAndStatusOrderByCreatedAtDesc(UUID tenantId, String status);
    boolean existsByTenant_IdAndAlertKeyAndStatus(UUID tenantId, String alertKey, String status);
    java.util.Optional<AiAlert> findByIdAndTenant_Id(UUID id, UUID tenantId);
    /** Most recent alert (any status) for a key — used to upsert/refresh instead of duplicating. */
    java.util.Optional<AiAlert> findFirstByTenant_IdAndAlertKeyOrderByCreatedAtDesc(UUID tenantId, String alertKey);
    /** All alerts currently in the given statuses — used to auto-resolve ones whose condition cleared. */
    List<AiAlert> findByTenant_IdAndStatusIn(UUID tenantId, List<String> statuses);
}
