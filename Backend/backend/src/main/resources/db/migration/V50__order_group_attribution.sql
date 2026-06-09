-- Preserve the link from an order back to its originating group cart, plus capture-only signals
-- (is it a group order, how many people contributed). Forward-only; not yet wired into scoring.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS group_cart_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_group_order BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS group_participant_count INTEGER;
