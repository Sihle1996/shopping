CREATE TABLE IF NOT EXISTS combos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           VARCHAR(128) NOT NULL,
  description    TEXT,
  combo_price    NUMERIC(10,2) NOT NULL,
  original_price NUMERIC(10,2) NOT NULL,
  source         VARCHAR(16)  NOT NULL DEFAULT 'VENDOR',
  active         BOOLEAN      NOT NULL DEFAULT TRUE,
  image_url      VARCHAR(1024),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS combo_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id     UUID NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  role         VARCHAR(16)  NOT NULL DEFAULT 'MAIN',
  quantity     INTEGER      NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_combos_tenant ON combos(tenant_id, active);
