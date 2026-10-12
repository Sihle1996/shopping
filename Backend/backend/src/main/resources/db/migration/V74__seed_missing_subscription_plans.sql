INSERT INTO subscription_plans (
    id,
    name,
    price,
    max_menu_items,
    max_drivers,
    max_promotions,
    max_delivery_radius_km,
    has_analytics,
    has_custom_branding,
    has_inventory_export,
    commission_percent,
    features,
    created_at,
    has_promo_ai,
    has_driver_intel,
    has_review_ai,
    has_api_access,
    copilot_monthly_quota
)
VALUES
(
    gen_random_uuid(), 'BASIC', 299.00,
    30, 3, 3, 10,
    FALSE, FALSE, FALSE, 4.00,
    'Basic plan', NOW(),
    FALSE, FALSE, FALSE, FALSE, 50
),
(
    gen_random_uuid(), 'PRO', 699.00,
    100, 10, 20, 25,
    TRUE, TRUE, TRUE, 3.00,
    'Pro plan', NOW(),
    TRUE, TRUE, TRUE, FALSE, 500
),
(
    gen_random_uuid(), 'ENTERPRISE', 1499.00,
    99999, 99999, 99999, 200,
    TRUE, TRUE, TRUE, 2.00,
    'Enterprise plan', NOW(),
    TRUE, TRUE, TRUE, TRUE, NULL
)
ON CONFLICT (name) DO NOTHING;
