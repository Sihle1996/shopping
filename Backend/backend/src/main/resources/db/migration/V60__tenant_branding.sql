-- Storefront branding: cover/hero image, short description, and social links.
-- All nullable (existing rows keep NULL); prod runs ddl-auto=validate so these must match the entity.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cover_image_url  VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS store_description TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS instagram_url    VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS facebook_url     VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS website_url      VARCHAR(255);
