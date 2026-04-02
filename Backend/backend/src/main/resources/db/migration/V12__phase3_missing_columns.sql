-- V12: Add the non-nullable columns that Hibernate ddl-auto=update would
-- otherwise try to add WITHOUT a DEFAULT, causing PostgreSQL to reject them
-- on tables that already have rows.  All nullable columns are included here
-- too so Hibernate skips them entirely.

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS estimated_delivery_minutes INT NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS opening_hours              TEXT,
    ADD COLUMN IF NOT EXISTS cuisine_type               VARCHAR(50);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS order_notes   TEXT,
    ADD COLUMN IF NOT EXISTS guest_email   VARCHAR(255),
    ADD COLUMN IF NOT EXISTS guest_phone   VARCHAR(50);

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS special_instructions TEXT;

ALTER TABLE cart_items
    ADD COLUMN IF NOT EXISTS selected_choices_json TEXT;
