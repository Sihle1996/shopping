-- Proactive AI "Smart Alerts" surfaced in the admin bell.
CREATE TABLE IF NOT EXISTS ai_alert (
    id         uuid PRIMARY KEY,
    tenant_id  uuid,
    alert_key  varchar(120) NOT NULL,
    severity   varchar(20)  NOT NULL,
    title      varchar(255) NOT NULL,
    body       text,
    action     text,
    status     varchar(20)  NOT NULL DEFAULT 'NEW',
    created_at timestamp    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_alert_tenant_status ON ai_alert (tenant_id, status, created_at DESC);
