CREATE TABLE IF NOT EXISTS item_tags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tag          VARCHAR(64) NOT NULL,
  UNIQUE(menu_item_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_item_tags_tenant ON item_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_item_tags_tag    ON item_tags(tag);
