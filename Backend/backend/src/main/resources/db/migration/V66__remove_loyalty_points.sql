-- Remove the loyalty-points feature entirely.
-- Drops the loyalty tables (transactions first — it FKs to accounts) and the two
-- loyalty columns added by earlier migrations. Idempotent guards so it is safe to
-- re-run and tolerant of environments where the objects were never created.

DROP TABLE IF EXISTS loyalty_transactions CASCADE;
DROP TABLE IF EXISTS loyalty_accounts CASCADE;

ALTER TABLE tenants DROP COLUMN IF EXISTS loyalty_enabled;
ALTER TABLE orders  DROP COLUMN IF EXISTS loyalty_points_redeemed;
