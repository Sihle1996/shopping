-- Align the PRO plan's commission to the agreed re-tier rate (3%; the row held a stale 2.50%).
-- The order fee reads tenant.platform_commission_percent, which is now synced from the plan's
-- commission_percent whenever a plan is assigned (SuperAdmin assign-plan + the Spring upgrade paths).
-- BASIC stays at 4%. Existing tenants keep their current rate until their next plan (re)assignment.
UPDATE subscription_plans SET commission_percent = 3.00 WHERE name = 'PRO';
