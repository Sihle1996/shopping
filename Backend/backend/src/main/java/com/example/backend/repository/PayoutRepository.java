package com.example.backend.repository;

import com.example.backend.entity.Payout;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface PayoutRepository extends JpaRepository<Payout, UUID> {
    List<Payout> findByTenant_IdOrderByCreatedAtDesc(UUID tenantId);
    List<Payout> findAllByOrderByCreatedAtDesc();

    /** End of the tenant's last settlement period — the next period starts here (no double-paying). */
    @Query("SELECT MAX(p.periodEnd) FROM Payout p WHERE p.tenant.id = :tenantId")
    Instant lastPeriodEnd(@Param("tenantId") UUID tenantId);
}
