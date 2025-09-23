CREATE TABLE IF NOT EXISTS promotions (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(1024),
    badge_text VARCHAR(64),
    discount_percent NUMERIC(10,2),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    applies_to VARCHAR(32) NOT NULL,
    target_category_id BIGINT,
    target_product_id BIGINT,
    code VARCHAR(128),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    featured BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active);
CREATE INDEX IF NOT EXISTS idx_promotions_schedule ON promotions(start_at, end_at);
