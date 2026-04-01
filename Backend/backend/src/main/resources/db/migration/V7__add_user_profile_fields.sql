-- Add active flag and profile fields to _user table
ALTER TABLE _user
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(50),
    ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
