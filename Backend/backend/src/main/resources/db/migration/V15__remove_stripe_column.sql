-- V15: Remove unused Stripe account ID column from tenants
ALTER TABLE tenants DROP COLUMN IF EXISTS stripe_account_id;
