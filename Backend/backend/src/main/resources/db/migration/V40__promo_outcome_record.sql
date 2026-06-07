-- Memory for the promo learning loop: one measured result per finished PRODUCT promo.
CREATE TABLE IF NOT EXISTS promo_outcome_record (
    id               UUID PRIMARY KEY,
    tenant_id        UUID,
    product_id       UUID,
    promo_id         UUID UNIQUE,
    net_lift_percent INTEGER,
    sample_units     INTEGER,
    recorded_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_por_tenant_product
    ON promo_outcome_record (tenant_id, product_id);
