-- Unified human-readable activity trail (who did what, when) — complements inventory_logs/ai_action_log.
CREATE TABLE IF NOT EXISTS audit_event (
    id           UUID PRIMARY KEY,
    tenant_id    UUID,
    actor_email  VARCHAR(255),
    actor_role   VARCHAR(40),
    source       VARCHAR(16)  NOT NULL,
    action       VARCHAR(40)  NOT NULL,
    entity_type  VARCHAR(24),
    entity_id    UUID,
    summary      VARCHAR(500),
    created_at   TIMESTAMPTZ  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit_event (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_event (entity_id);
