-- Optional per-code redemption cap. NULL max_redemptions = unlimited (existing behaviour); the code
-- stops validating once redemption_count reaches the cap.
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS max_redemptions INTEGER;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS redemption_count INTEGER NOT NULL DEFAULT 0;
