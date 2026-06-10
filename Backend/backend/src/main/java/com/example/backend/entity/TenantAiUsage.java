package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Per-tenant, per-month, per-feature AI usage + estimated cost. One row per
 * (tenant, year_month, feature); incremented atomically on every LLM call.
 * Feeds the (future) super-admin AI Economics view — cost per tenant/feature.
 */
@Entity
@Table(name = "tenant_ai_usage",
        uniqueConstraints = @UniqueConstraint(name = "uq_tenant_ai_usage",
                columnNames = {"tenant_id", "year_month", "feature"}))
@Data
@NoArgsConstructor
public class TenantAiUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "year_month", nullable = false, length = 7)
    private String yearMonth;   // e.g. "2026-06"

    @Column(nullable = false, length = 40)
    private String feature;     // COPILOT | BRIEFING | DESCRIBE_ITEM | REVIEW_DIGEST | REVIEW_REPLY | OTHER

    @Column(name = "call_count", nullable = false)
    private long callCount;

    @Column(name = "tokens_used", nullable = false)
    private long tokensUsed;

    @Column(name = "estimated_cost_rand", nullable = false)
    private double estimatedCostRand;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
