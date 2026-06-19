-- Idempotency flag mirroring payout_credited, so a refund is debited from the store's ledger at most
-- once per order regardless of status flip-flops or re-entry.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payout_debited BOOLEAN DEFAULT FALSE;
