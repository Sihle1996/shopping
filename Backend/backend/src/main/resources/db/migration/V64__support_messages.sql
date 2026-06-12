-- Support conversation thread: a real back-and-forth (customer / store / CraveIt) replacing the old
-- single-field replies. Prod runs ddl-auto=validate, so this table must match the SupportMessage entity.
CREATE TABLE IF NOT EXISTS support_messages (
    id           UUID PRIMARY KEY,
    ticket_id    UUID,
    sender_role  VARCHAR(255) NOT NULL,
    sender_email VARCHAR(255),
    body         TEXT NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_support_messages_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id, created_at);
