-- Phase 3: make orders.user_id nullable so guest checkout works.
-- All other Phase 3 DDL (new columns + new tables) is handled by
-- spring.jpa.hibernate.ddl-auto=update on startup.
-- This migration only contains the one statement Hibernate cannot perform
-- on its own: dropping a NOT NULL constraint from an existing column.

ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
