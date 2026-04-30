package com.example.backend.repository;

import com.example.backend.entity.IntentProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface IntentProfileRepository extends JpaRepository<IntentProfile, UUID> {

    // Tenant-specific override
    Optional<IntentProfile> findByIntentKeyAndTenant_Id(String intentKey, UUID tenantId);

    // Global default (tenant is null)
    Optional<IntentProfile> findByIntentKeyAndTenantIsNull(String intentKey);

    // All global defaults
    List<IntentProfile> findByTenantIsNull();

    // All for a specific tenant (overrides)
    List<IntentProfile> findByTenant_Id(UUID tenantId);
}
