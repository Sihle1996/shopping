-- Feedback + outcome loop for the driver recommendation engine: what it recommended vs what the
-- admin assigned, and (on delivery) how that choice performed. Lets us measure acceptance rate and
-- accepted-vs-overridden delivery outcomes instead of guessing whether the engine helps.
CREATE TABLE IF NOT EXISTS recommendation_decision (
    id                    UUID PRIMARY KEY,
    tenant_id             UUID,
    order_id              UUID NOT NULL,
    recommended_driver_id UUID,
    recommendation_score  DOUBLE PRECISION,
    assigned_driver_id    UUID,
    accepted              BOOLEAN NOT NULL DEFAULT FALSE,
    driver_leg_minutes    INTEGER,
    on_time               BOOLEAN,
    created_at            TIMESTAMPTZ,
    delivered_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_recdec_tenant ON recommendation_decision (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_recdec_order ON recommendation_decision (order_id);
