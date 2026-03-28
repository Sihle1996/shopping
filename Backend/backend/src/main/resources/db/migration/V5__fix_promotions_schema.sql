-- Drop and recreate promotions table with correct UUID types and tenant_id
DROP TABLE IF EXISTS promotions CASCADE;

CREATE TABLE promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description VARCHAR(2000),
    image_url VARCHAR(1024),
    badge_text VARCHAR(64),
    discount_percent NUMERIC(10,2),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    applies_to VARCHAR(32) NOT NULL,
    target_category_id UUID,
    target_product_id UUID,
    code VARCHAR(128),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    tenant_id UUID REFERENCES tenants(id)
);

CREATE INDEX idx_promotions_active ON promotions(active);
CREATE INDEX idx_promotions_schedule ON promotions(start_at, end_at);
CREATE INDEX idx_promotions_tenant ON promotions(tenant_id);
