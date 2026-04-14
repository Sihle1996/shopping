-- OTP delivery confirmation fields on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_otp    VARCHAR(10);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS otp_expires_at  TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS otp_verified    BOOLEAN NOT NULL DEFAULT FALSE;

-- Weekly store hours schedule per tenant
CREATE TABLE IF NOT EXISTS store_hours (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    open_time    VARCHAR(5) NOT NULL DEFAULT '08:00',
    close_time   VARCHAR(5) NOT NULL DEFAULT '22:00',
    closed       BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (tenant_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_store_hours_tenant ON store_hours(tenant_id);
