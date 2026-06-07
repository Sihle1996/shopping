-- Legacy menu_items rows can have a NULL optimistic-lock version (rows that
-- predate the @Version column). Hibernate cannot increment a null version, so
-- any update to such a row (e.g. the scheduled auto-reject releasing reserved
-- stock) throws an NPE on flush and rolls the transaction back. Backfill to 0.
UPDATE menu_items SET version = 0 WHERE version IS NULL;
