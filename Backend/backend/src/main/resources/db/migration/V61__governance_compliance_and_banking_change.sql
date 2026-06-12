-- Governance: Compliance/Operations role split + banking-change re-review.
-- Prod runs ddl-auto=validate, so these columns must exist to match the entities
-- (User.complianceOfficer, Tenant.bankingChangeStatus + pendingBank*). All nullable
-- except the flag, which defaults false so existing rows are unaffected.

-- A SUPERADMIN with this flag is a Compliance officer (may open KYB docs + see full bank numbers).
ALTER TABLE _user ADD COLUMN IF NOT EXISTS compliance_officer BOOLEAN NOT NULL DEFAULT FALSE;

-- Banking-change re-review: a proposed change is staged here until a compliance super-admin approves it;
-- the live bank_* columns are not touched until then.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS banking_change_status       VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pending_bank_name           VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pending_bank_account_number VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pending_bank_account_type   VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pending_bank_branch_code    VARCHAR(10);
