-- Smart Alerts now carry a quantified money impact (JSON) so owners can triage
-- by revenue / profit at risk, not just severity.
ALTER TABLE ai_alert ADD COLUMN IF NOT EXISTS impact text;
