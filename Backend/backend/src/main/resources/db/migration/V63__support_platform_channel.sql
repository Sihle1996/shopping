-- Tier-3 store->platform support + superadmin replies. Prod runs ddl-auto=validate, so these columns must
-- exist + match the entity (SupportTicket.audience/platformNote/platformReviewedAt).
--   audience: STORE = customer->store (default, existing rows), PLATFORM = store->CraveIt request
--   platform_note / platform_reviewed_at: the superadmin's response + when they acted
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS audience             VARCHAR(20) NOT NULL DEFAULT 'STORE';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS platform_note        TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS platform_reviewed_at TIMESTAMP WITH TIME ZONE;
