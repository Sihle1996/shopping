-- Align subscription_plans with today's plan tiering:
--   * BASIC is a paid tier at R299 (the row held a stale R0).
--   * ENTERPRISE (R1499, 2% commission) was MISSING entirely — it could be offered to stores
--     (store-side price list) but never assigned, since assign-plan requires the row to exist.
-- PRO was already aligned to 3% in V56. The free self-limiting STARTER tier is part of the
-- next-phase SuperAdmin re-tier and is intentionally NOT added here.
UPDATE subscription_plans SET price = 299.00 WHERE name = 'BASIC';

INSERT INTO subscription_plans (id, name, price, commission_percent, max_menu_items, max_drivers,
        max_promotions, max_delivery_radius_km, has_analytics, has_custom_branding, has_inventory_export,
        features, created_at)
SELECT gen_random_uuid(), 'ENTERPRISE', 1499.00, 2.00, 99999, 99999, 99999, 200, true, true, true,
        'Enterprise plan', now()
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'ENTERPRISE');
