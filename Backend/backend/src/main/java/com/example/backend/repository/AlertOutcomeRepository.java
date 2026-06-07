package com.example.backend.repository;

import com.example.backend.entity.AlertOutcome;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AlertOutcomeRepository extends JpaRepository<AlertOutcome, UUID> {

    List<AlertOutcome> findByTenantId(UUID tenantId);
}
