-- Add FCM token and promo opt-in flag to users
ALTER TABLE _user
    ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(255);

ALTER TABLE _user
    ADD COLUMN IF NOT EXISTS promo_opt_in BOOLEAN NOT NULL DEFAULT FALSE;
