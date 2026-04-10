-- V16: Seed subscription plans with correct ZAR prices and full feature limits
-- Inserts plans if they don't exist, updates if they do (upsert via ON CONFLICT).

INSERT INTO subscription_plans (id, name, price, max_menu_items, max_drivers, max_promotions,
    max_delivery_radius_km, has_analytics, has_custom_branding, has_inventory_export,
    commission_percent, created_at)
VALUES
    (gen_random_uuid(), 'BASIC',      299.00,  30,   3,   3,   10, FALSE, FALSE, FALSE, 4.00, NOW()),
    (gen_random_uuid(), 'PRO',        699.00,  100,  10,  20,  25, TRUE,  TRUE,  TRUE,  3.00, NOW()),
    (gen_random_uuid(), 'ENTERPRISE', 1499.00, 9999, 999, 999, 50, TRUE,  TRUE,  TRUE,  2.00, NOW())
ON CONFLICT (name) DO UPDATE SET
    price                  = EXCLUDED.price,
    max_menu_items         = EXCLUDED.max_menu_items,
    max_drivers            = EXCLUDED.max_drivers,
    max_promotions         = EXCLUDED.max_promotions,
    max_delivery_radius_km = EXCLUDED.max_delivery_radius_km,
    has_analytics          = EXCLUDED.has_analytics,
    has_custom_branding    = EXCLUDED.has_custom_branding,
    has_inventory_export   = EXCLUDED.has_inventory_export,
    commission_percent     = EXCLUDED.commission_percent;
