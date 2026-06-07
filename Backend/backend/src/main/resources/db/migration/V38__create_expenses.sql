-- CraveIt Books — operating expenses (money out) for the true bottom line.
CREATE TABLE IF NOT EXISTS expenses (
    id           uuid PRIMARY KEY,
    label        varchar(255) NOT NULL,
    category     varchar(64),
    amount       double precision NOT NULL,
    recurring    boolean NOT NULL DEFAULT false,
    incurred_on  date NOT NULL,
    tenant_id    uuid REFERENCES tenants(id),
    created_at   timestamp
);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_incurred_on ON expenses(incurred_on);
