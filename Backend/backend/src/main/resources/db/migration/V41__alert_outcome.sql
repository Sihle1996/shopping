-- Calibration memory: what each applied alert fix predicted vs the item baseline at the time.
CREATE TABLE IF NOT EXISTS alert_outcome (
    id                        UUID PRIMARY KEY,
    tenant_id                 UUID,
    alert_key                 VARCHAR(255),
    alert_type                VARCHAR(100),
    item_id                   UUID,
    predicted_revenue_at_risk DOUBLE PRECISION,
    predicted_net_at_risk     DOUBLE PRECISION,
    baseline_units30d         INTEGER,
    applied_at                TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_outcome_tenant ON alert_outcome (tenant_id);
