-- Join table for multi-product promotions
CREATE TABLE promotion_products (
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    product_id   UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    PRIMARY KEY (promotion_id, product_id)
);

CREATE INDEX idx_promo_products_promo ON promotion_products(promotion_id);
