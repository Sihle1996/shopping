package com.example.backend.repository;

import com.example.backend.entity.AiActionLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AiActionLogRepository extends JpaRepository<AiActionLog, UUID> {
    List<AiActionLog> findByTenant_IdOrderByCreatedAtDesc(UUID tenantId);
}
