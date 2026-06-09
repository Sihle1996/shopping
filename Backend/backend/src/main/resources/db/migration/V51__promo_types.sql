-- Advanced promotion types (Phase 1): spend-threshold, free delivery, fixed-amount off — alongside
-- the existing percentage-off. Nullable + backfilled so it's safe to add to a populated table and
-- consistent between local (ddl-auto) and prod (Flyway). Null promo_type is read as PERCENT_OFF.
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS promo_type      VARCHAR(20);
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS min_spend       NUMERIC(10,2);
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2);
UPDATE promotions SET promo_type = 'PERCENT_OFF' WHERE promo_type IS NULL;
