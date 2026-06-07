-- Audit trail of AI copilot actions the admin confirmed and applied.
CREATE TABLE IF NOT EXISTS ai_action_log (
    id         uuid PRIMARY KEY,
    tenant_id  uuid,
    action     varchar(64) NOT NULL,
    params     text,
    status     varchar(20) NOT NULL,
    message    text,
    created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_action_log_tenant ON ai_action_log (tenant_id, created_at DESC);
