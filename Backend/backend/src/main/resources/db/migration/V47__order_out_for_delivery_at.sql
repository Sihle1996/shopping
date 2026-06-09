-- When the order was dispatched (went Out for Delivery). Lets us measure the DRIVER leg
-- (dispatch -> delivered) for the on-time score, isolating it from kitchen/admin delay.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMPTZ;
