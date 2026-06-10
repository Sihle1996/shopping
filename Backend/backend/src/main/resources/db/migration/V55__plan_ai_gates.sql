-- AI intelligence gates + Copilot quota on the plan itself (so pricing/quota changes are
-- DB updates, not code deploys). "Taste of AI": BASIC gets metered Copilot + operational AI;
-- PRO/ENTERPRISE get the money-making intelligence (promo/driver/review/support AI).
ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS has_promo_ai          BOOLEAN,
    ADD COLUMN IF NOT EXISTS has_driver_intel      BOOLEAN,
    ADD COLUMN IF NOT EXISTS has_review_ai         BOOLEAN,
    ADD COLUMN IF NOT EXISTS has_api_access        BOOLEAN,
    ADD COLUMN IF NOT EXISTS copilot_monthly_quota INTEGER;

UPDATE subscription_plans SET has_promo_ai=false, has_driver_intel=false, has_review_ai=false, has_api_access=false, copilot_monthly_quota=50   WHERE name='BASIC';
UPDATE subscription_plans SET has_promo_ai=true,  has_driver_intel=true,  has_review_ai=true,  has_api_access=false, copilot_monthly_quota=500  WHERE name='PRO';
UPDATE subscription_plans SET has_promo_ai=true,  has_driver_intel=true,  has_review_ai=true,  has_api_access=true,  copilot_monthly_quota=NULL WHERE name='ENTERPRISE';
