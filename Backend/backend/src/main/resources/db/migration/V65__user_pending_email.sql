-- Email change with re-verification: the new email a user is changing to, held here until they confirm it
-- via the verification link sent to the new address (the live login `email` is untouched until then).
-- Prod runs ddl-auto=validate, so this column must exist to match User.pendingEmail.
ALTER TABLE _user ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255);
