-- Driver pay MVP: base-fee-per-delivery + customer tips (100% to driver) + a real driver ledger.
-- Prod runs ddl-auto=validate, so these must match the entity columns exactly.

-- Tip is a SEPARATE order field (like delivery_fee) — never folded into total_amount, so store
-- revenue and platform commission are untouched and the tip passes straight to the driver.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_amount      DOUBLE PRECISION;
-- Idempotency guard for the driver credit (mirrors payout_credited for the store).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_credited BOOLEAN;

-- Store-set flat pay per delivery; replaces the (deprecated) driver_earning_percent basis.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS driver_base_fee NUMERIC(8,2) DEFAULT 25.00;

-- Per-driver running ledger, mirroring payout_ledger but keyed on the driver (a _user row).
-- entry_type: EARNING (base pay) | TIP (customer tip) | PAYOUT (settlement debit).
CREATE TABLE IF NOT EXISTS driver_ledger (
    id            UUID PRIMARY KEY,
    driver_id     UUID NOT NULL REFERENCES _user(id),
    order_id      UUID REFERENCES orders(id),
    entry_type    VARCHAR(20)   NOT NULL,
    amount_rand   NUMERIC(10,2) NOT NULL,
    balance_after NUMERIC(10,2) NOT NULL,
    description   TEXT,
    created_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_driver_ledger_driver_created
    ON driver_ledger (driver_id, created_at DESC);
