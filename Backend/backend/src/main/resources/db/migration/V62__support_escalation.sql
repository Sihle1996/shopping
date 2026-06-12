-- Support escalation: a customer can escalate a store support ticket to the platform (CraveIt), giving the
-- superadmin oversight of how stores treat customers. Prod runs ddl-auto=validate, so these columns must
-- exist + match the entity (SupportTicket.escalated/escalatedAt/escalationReason).
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS escalated         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS escalated_at      TIMESTAMP WITH TIME ZONE;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
