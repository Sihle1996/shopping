package com.example.backend.repository;

import com.example.backend.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, UUID> {
    Optional<Tenant> findBySlug(String slug);
    List<Tenant> findByActiveTrue();

    @Query("SELECT t FROM Tenant t WHERE t.subscriptionStatus = 'TRIAL' AND t.trialStartedAt < :cutoff")
    List<Tenant> findTrialTenantsStartedBefore(@Param("cutoff") LocalDateTime cutoff);

    List<Tenant> findBySubscriptionStatusAndTrialStartedAtBetween(
            String status, LocalDateTime from, LocalDateTime to);
}
