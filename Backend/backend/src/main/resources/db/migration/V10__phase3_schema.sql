-- Phase 3: competitive parity schema additions

-- Tenant: ETA, opening hours, cuisine type
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS estimated_delivery_minutes INT NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS opening_hours TEXT,
    ADD COLUMN IF NOT EXISTS cuisine_type VARCHAR(50);

-- Orders: delivery notes + guest checkout support
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS order_notes TEXT,
    ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(50);

-- Make orders.user_id nullable (guest orders have no user)
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

-- Order items: per-item special instructions
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- Cart items: serialised modifier selections
ALTER TABLE cart_items
    ADD COLUMN IF NOT EXISTS selected_choices_json TEXT;

-- Menu item option groups (Size, Spice level, etc.)
CREATE TABLE IF NOT EXISTS menu_item_option_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'RADIO',
    required BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT DEFAULT 0
);

-- Choices within each option group
CREATE TABLE IF NOT EXISTS menu_item_option_choices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_group_id UUID NOT NULL REFERENCES menu_item_option_groups(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    price_modifier DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    sort_order INT DEFAULT 0
);

-- Snapshot of chosen options stored against each order item
CREATE TABLE IF NOT EXISTS order_item_choices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    group_name VARCHAR(100) NOT NULL,
    choice_label VARCHAR(100) NOT NULL,
    price_modifier DECIMAL(10,2) NOT NULL DEFAULT 0.00
);
