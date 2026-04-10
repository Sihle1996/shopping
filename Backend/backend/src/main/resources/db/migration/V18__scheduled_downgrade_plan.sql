-- V18: Track which plan a tenant will be downgraded to on cancellation
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS scheduled_downgrade_plan VARCHAR(20);
