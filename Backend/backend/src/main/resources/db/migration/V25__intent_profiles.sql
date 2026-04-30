CREATE TABLE IF NOT EXISTS intent_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID REFERENCES tenants(id) ON DELETE CASCADE,
  intent_key           VARCHAR(32)  NOT NULL,
  label                VARCHAR(64)  NOT NULL,
  emoji                VARCHAR(8),
  max_price_rand       NUMERIC(10,2),
  preferred_tags       TEXT,
  excluded_tags        TEXT,
  preferred_categories TEXT,
  sort_by              VARCHAR(32)  NOT NULL DEFAULT 'SCORE',
  boost_promotions     BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_intent_profiles_key ON intent_profiles(intent_key);

-- Global defaults (tenant_id IS NULL = applies to all stores)
INSERT INTO intent_profiles (intent_key, label, emoji, max_price_rand, preferred_tags, excluded_tags, preferred_categories, sort_by, boost_promotions)
VALUES
  ('HUNGRY',      'I''m hungry',   '🍔', NULL,  'filling,comfort',          '',              'Burgers,Pizza,Meals',  'SCORE',     TRUE),
  ('TIRED',       'Long day',      '😴', NULL,  'comfort,quick',            '',              'Burgers,Pasta,Noodles','SCORE',     TRUE),
  ('BROKE',       'On a budget',   '💸', 80.00, 'value',                    'premium',       '',                     'PRICE_ASC', TRUE),
  ('CELEBRATING', 'Celebrating!',  '🥳', NULL,  'premium,indulgent',        'plain',         '',                     'SCORE',     FALSE),
  ('HEALTHY',     'Eating clean',  '🥗', NULL,  'healthy,vegan,grilled',    'fried,greasy',  'Salads,Healthy,Wraps', 'SCORE',     FALSE);
