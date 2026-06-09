-- Per-order promo-economics capture (V52): which reward lever applied, the delivery fee the platform
-- waived for a FREE_DELIVERY promo, and who funded the promo. Durable source-of-truth for the later
-- type-aware Net-Revenue-Lift learning. All nullable (no promo -> NULL; never 0.0-for-N/A on the fee),
-- and nullable keeps local ddl-auto and prod Flyway in sync on a populated table.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_type         VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS waived_delivery_fee DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_funded_by    VARCHAR(16);
