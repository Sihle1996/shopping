-- V12: Add estimated_delivery_minutes to tenants.
-- This is the only Phase 3 column not yet in the live schema:
--   - opening_hours, cuisine_type         already added by C# startup SQL
--   - order_notes, guest_email, guest_phone already added by C# startup SQL
--   - special_instructions, selected_choices_json added by Hibernate ddl-auto=update
--   - estimated_delivery_minutes was rejected by Hibernate (NOT NULL, no DEFAULT)
--     and never added by C# — so it is the sole column missing.
ALTER TABLE tenants ADD COLUMN estimated_delivery_minutes INT NOT NULL DEFAULT 30;
