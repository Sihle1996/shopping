CREATE TABLE IF NOT EXISTS user_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES _user(id) ON DELETE SET NULL,
  session_id   VARCHAR(64)  NOT NULL,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type   VARCHAR(32)  NOT NULL,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  context_json TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_events_user   ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_tenant ON user_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_item   ON user_events(menu_item_id);
