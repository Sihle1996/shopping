-- Hibernate auto-generates CHECK constraints on @Enumerated(STRING) columns
-- listing the enum values known at schema-creation time. When an enum later
-- gains a value (as AppliesTo did with MULTI_PRODUCT), inserts/updates with the
-- new value fail with a 500. These checks are redundant — JPA only ever writes
-- valid enum names — so drop them on every enum-backed column to remove the trap.
-- Dynamic lookup handles unknown constraint names and skips tables that don't exist.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT rel.relname AS table_name, con.conname AS constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE con.contype = 'c'
          AND nsp.nspname = current_schema()
          AND rel.relname IN ('promotions', 'support_tickets', 'tenants',
                              'store_documents', 'payouts', '_user')
          AND (con.conname LIKE '%applies_to%check%'
            OR con.conname LIKE '%status%check%'
            OR con.conname LIKE '%role%check%'
            OR con.conname LIKE '%driver_status%check%'
            OR con.conname LIKE '%approval_status%check%'
            OR con.conname LIKE '%document_type%check%')
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    END LOOP;
END $$;
