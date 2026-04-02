-- V11: Add columns that were missing from V10 and required by Hibernate entity validation
-- These were previously expected from C# SuperAdmin startup SQL but never Flyway-managed.

-- trial_started_at on tenants (used by TrialExpiryService)
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP;

-- Back-fill trial_started_at for existing TRIAL tenants
UPDATE tenants
    SET trial_started_at = created_at
    WHERE subscription_status = 'TRIAL' AND trial_started_at IS NULL;

-- Subscription plan feature-gate columns (used by SubscriptionPlan entity)
ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS max_promotions          INT            NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS max_delivery_radius_km  INT            NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS has_analytics           BOOLEAN        NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_custom_branding     BOOLEAN        NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_inventory_export    BOOLEAN        NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS commission_percent      DECIMAL(5,2);

-- Seed correct values for each plan tier
UPDATE subscription_plans SET
    max_promotions = 3, max_delivery_radius_km = 10,
    has_analytics = FALSE, has_custom_branding = FALSE,
    has_inventory_export = FALSE, commission_percent = 4.00
WHERE name = 'BASIC';

UPDATE subscription_plans SET
    max_promotions = 20, max_delivery_radius_km = 25,
    has_analytics = TRUE, has_custom_branding = TRUE,
    has_inventory_export = TRUE, commission_percent = 3.00
WHERE name = 'PRO';

UPDATE subscription_plans SET
    max_promotions = 999, max_delivery_radius_km = 50,
    has_analytics = TRUE, has_custom_branding = TRUE,
    has_inventory_export = TRUE, commission_percent = 2.00
WHERE name = 'ENTERPRISE';
