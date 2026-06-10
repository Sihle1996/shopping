-- Per-tenant monthly AI usage + cost tracking. This data is irreversible-if-missed:
-- capture cost-per-tenant from the first real AI call so we can later answer
-- "which stores are expensive, what is AI costing per tenant/feature".
CREATE TABLE IF NOT EXISTS tenant_ai_usage (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    year_month          VARCHAR(7) NOT NULL,          -- e.g. '2026-06'
    feature             VARCHAR(40) NOT NULL,         -- COPILOT | BRIEFING | DESCRIBE_ITEM | REVIEW_DIGEST | ... | OTHER
    call_count          BIGINT NOT NULL DEFAULT 0,
    tokens_used         BIGINT NOT NULL DEFAULT 0,
    estimated_cost_rand DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at          TIMESTAMP,
    CONSTRAINT uq_tenant_ai_usage UNIQUE (tenant_id, year_month, feature)
);
CREATE INDEX IF NOT EXISTS idx_tenant_ai_usage_tenant_month ON tenant_ai_usage (tenant_id, year_month);
