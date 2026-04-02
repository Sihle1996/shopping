-- V13: Customer reviews — one review per order, 1-5 star rating + optional comment.
-- All new table, no NOT NULL on nullable columns, safe on any PostgreSQL version.
CREATE TABLE reviews (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tenant_id    UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    rating       INT  NOT NULL,
    comment      TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (order_id)
);
