-- CraveIt Books — Phase 1: capture what each item costs the store to make.
-- Optional (nullable): when absent, Books estimates COGS at a benchmark % of price.
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS cost numeric(10,2);
