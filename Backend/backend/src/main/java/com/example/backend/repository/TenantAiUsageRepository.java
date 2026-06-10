package com.example.backend.repository;

import com.example.backend.entity.TenantAiUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TenantAiUsageRepository extends JpaRepository<TenantAiUsage, UUID> {

    List<TenantAiUsage> findByTenantIdAndYearMonth(UUID tenantId, String yearMonth);

    /**
     * Atomic upsert-increment: one statement, race-safe under concurrent AI calls
     * (same pattern as the inventory reservation). Inserts the (tenant, month, feature)
     * row or increments it in place.
     */
    @Modifying
    @Query(value = "INSERT INTO tenant_ai_usage " +
            "(id, tenant_id, year_month, feature, call_count, tokens_used, estimated_cost_rand, updated_at) " +
            "VALUES (gen_random_uuid(), :tenantId, :ym, :feature, 1, :tokens, :cost, now()) " +
            "ON CONFLICT (tenant_id, year_month, feature) DO UPDATE SET " +
            "call_count = tenant_ai_usage.call_count + 1, " +
            "tokens_used = tenant_ai_usage.tokens_used + :tokens, " +
            "estimated_cost_rand = tenant_ai_usage.estimated_cost_rand + :cost, " +
            "updated_at = now()", nativeQuery = true)
    void recordUsage(@Param("tenantId") UUID tenantId, @Param("ym") String ym,
                     @Param("feature") String feature, @Param("tokens") long tokens,
                     @Param("cost") double cost);
}
