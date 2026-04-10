-- V17: Add subscription cancellation and billing period tracking to tenants
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS billing_period_end     TIMESTAMP,
    ADD COLUMN IF NOT EXISTS subscription_cancelled_at TIMESTAMP;
