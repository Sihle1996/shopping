-- Stable promo attribution (V53): the id of the promotion applied to the order, so cost analytics
-- anchor on the promo's identity rather than its (editable) code/title. Nullable; no promo -> NULL.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_id UUID;
