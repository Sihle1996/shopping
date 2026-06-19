-- Idempotency flag so a store is credited in the payout ledger exactly once per order, regardless of
-- delivery path (admin status update vs driver OTP/confirm) or concurrent transitions.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payout_credited BOOLEAN DEFAULT FALSE;

-- Backfill: existing delivered orders have already been credited (or are historical) — mark them so
-- the new idempotency guard never re-credits them.
UPDATE orders SET payout_credited = TRUE WHERE status = 'Delivered';
