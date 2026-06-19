-- Storefront branding theme (PRO): font, accent/secondary colour, and CTA button style.
-- All nullable (existing rows keep NULL → storefront falls back to CraveIt defaults).
-- Prod runs ddl-auto=validate, so these must match the Tenant entity columns exactly.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS brand_font      VARCHAR(40);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS button_style    VARCHAR(20);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS button_fill     VARCHAR(20);
