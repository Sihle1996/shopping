-- How an order's delivery was confirmed, so an admin override is distinguishable from a genuine
-- driver/OTP-confirmed delivery: DRIVER_OTP | DRIVER | ADMIN_OVERRIDE. Null for non-delivered orders.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_by VARCHAR(20);
