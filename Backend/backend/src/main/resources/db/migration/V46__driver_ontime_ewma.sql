-- Recency-weighted on-time reliability score per driver (EWMA of on-time hits, 0..1), updated
-- O(1) on each delivery. Replaces the volatile raw-average-time signal in driver recommendations
-- and accumulates forward (so insights fill in without backfilling historical delivery times).
ALTER TABLE _user ADD COLUMN IF NOT EXISTS delivery_score_ewma DOUBLE PRECISION;
ALTER TABLE _user ADD COLUMN IF NOT EXISTS delivery_score_samples INTEGER DEFAULT 0;
