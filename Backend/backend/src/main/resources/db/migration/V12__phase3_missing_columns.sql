-- V12: Add the three Phase 3 columns confirmed missing from the live schema.
-- NOTE: Do NOT use ADD COLUMN IF NOT EXISTS here.
-- Flyway 10.21.0 on PostgreSQL 18.3 treats the 42701 "duplicate column" NOTICE
-- that IF NOT EXISTS emits as an error and rolls back the whole migration.
-- Only the columns that are absent from the DB are listed below.

ALTER TABLE tenants     ADD COLUMN estimated_delivery_minutes INT  NOT NULL DEFAULT 30;
ALTER TABLE order_items ADD COLUMN special_instructions       TEXT;
ALTER TABLE cart_items  ADD COLUMN selected_choices_json      TEXT;
