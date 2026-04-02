-- Phase 3: competitive parity schema additions
-- Each ALTER TABLE uses a DO block so pre-existing columns are silently skipped.
-- CREATE TABLE IF NOT EXISTS is already idempotent.

-- Tenant: ETA, opening hours, cuisine type
DO $$ BEGIN ALTER TABLE tenants ADD COLUMN estimated_delivery_minutes INT NOT NULL DEFAULT 30; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tenants ADD COLUMN opening_hours TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tenants ADD COLUMN cuisine_type VARCHAR(50); EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Orders: delivery notes + guest checkout support
DO $$ BEGIN ALTER TABLE orders ADD COLUMN order_notes TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders ADD COLUMN guest_email VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders ADD COLUMN guest_phone VARCHAR(50); EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Make orders.user_id nullable (guest orders have no user)
DO $$ BEGIN ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'user_id drop not null skipped: %', SQLERRM; END $$;

-- Order items: per-item special instructions
DO $$ BEGIN ALTER TABLE order_items ADD COLUMN special_instructions TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Cart items: serialised modifier selections
DO $$ BEGIN ALTER TABLE cart_items ADD COLUMN selected_choices_json TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

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
