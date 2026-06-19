-- Token version for stateless JWT revocation: bumped on logout / password change / reset so all
-- previously-issued tokens for the user stop validating.
ALTER TABLE _user ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
