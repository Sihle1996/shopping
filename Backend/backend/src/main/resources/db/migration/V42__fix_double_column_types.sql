-- Align column types with their JPA mappings so prod schema-validation passes.
-- menu_items.cost and orders.discount_amount are mapped to Double in the entities
-- (double precision / float8), but earlier migrations created them as numeric.
-- ALTER ... TYPE double precision is a no-op where the column is already float8.
ALTER TABLE menu_items
    ALTER COLUMN cost TYPE double precision USING cost::double precision;

ALTER TABLE orders
    ALTER COLUMN discount_amount TYPE double precision USING discount_amount::double precision;
