ALTER TABLE menu_items ADD COLUMN stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN reserved_stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS inventory_logs (
    id SERIAL PRIMARY KEY,
    menu_item_id BIGINT REFERENCES menu_items(id),
    stock_change INTEGER NOT NULL,
    reserved_change INTEGER NOT NULL,
    type VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
