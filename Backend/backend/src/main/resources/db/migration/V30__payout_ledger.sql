CREATE TABLE IF NOT EXISTS payout_ledger (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id),
    order_id      UUID REFERENCES orders(id),
    entry_type    VARCHAR(16) NOT NULL,
    amount_rand   NUMERIC(10,2) NOT NULL,
    balance_after NUMERIC(10,2) NOT NULL,
    description   VARCHAR(256),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_tenant ON payout_ledger(tenant_id, created_at DESC);
