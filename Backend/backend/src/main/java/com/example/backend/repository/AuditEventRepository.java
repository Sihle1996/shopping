package com.example.backend.repository;

import com.example.backend.entity.AuditEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {
    List<AuditEvent> findByTenantIdAndEntityIdOrderByCreatedAtDesc(UUID tenantId, UUID entityId);
    Page<AuditEvent> findByTenantIdOrderByCreatedAtDesc(UUID tenantId, Pageable pageable);
}
