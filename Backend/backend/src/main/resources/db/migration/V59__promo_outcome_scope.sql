-- Let store-wide (ALL) and multi-product promos self-measure, not just per-product ones.
-- PRODUCT rows keep product_id; ALL/MULTI_PRODUCT rows have product_id null + this scope tag.
-- DEFAULT 'PRODUCT' backfills existing rows (all of which were per-product).
ALTER TABLE promo_outcome_record ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'PRODUCT';
