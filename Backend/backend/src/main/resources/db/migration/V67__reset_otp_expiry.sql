-- Password-reset OTP now has a server-enforced 15-minute lifetime (the email already promised it).
ALTER TABLE _user ADD COLUMN IF NOT EXISTS reset_otp_expires_at TIMESTAMP;
