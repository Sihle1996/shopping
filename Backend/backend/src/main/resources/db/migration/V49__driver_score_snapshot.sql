-- Daily history of each driver's on-time score, so future features can show real trends instead
-- of inventing them (we only keep one live EWMA value per driver otherwise).
CREATE TABLE IF NOT EXISTS driver_score_snapshot (
    id            UUID PRIMARY KEY,
    tenant_id     UUID,
    driver_id     UUID NOT NULL,
    on_time_rate  INTEGER,
    samples       INTEGER,
    snapshot_date DATE NOT NULL,
    created_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_driver_snapshot_day ON driver_score_snapshot (driver_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_driver_snapshot_tenant ON driver_score_snapshot (tenant_id, snapshot_date);
