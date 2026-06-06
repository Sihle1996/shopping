-- The applies_to CHECK constraint (auto-generated when the enum was ALL/CATEGORY/
-- PRODUCT) rejected MULTI_PRODUCT, so multi-product promotions failed to save.
-- Recreate it with the full current enum.
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_applies_to_check;
ALTER TABLE promotions ADD CONSTRAINT promotions_applies_to_check
    CHECK (applies_to IN ('ALL', 'CATEGORY', 'PRODUCT', 'MULTI_PRODUCT'));
