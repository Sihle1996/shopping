-- V14: Loyalty points — one account per user per store, transaction log.
-- All new tables, no NOT NULL without DEFAULT.
CREATE TABLE loyalty_accounts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    balance      INT  NOT NULL DEFAULT 0,
    total_earned INT  NOT NULL DEFAULT 0,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tenant_id)
);

CREATE TABLE loyalty_transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
    order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
    points      INT  NOT NULL,
    type        VARCHAR(20) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
