-- Per-store auto-cancel window for unaccepted orders (minutes; 0 = disabled). Default 15
-- (was a hard-coded 5 for all stores — too aggressive for a busy kitchen).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_cancel_minutes INTEGER DEFAULT 15;

-- Marks WHY an order was cancelled (e.g. AUTO_TIMEOUT) so the AI can surface the pattern
-- and the cancellation rate can separate auto-cancels from genuine ones.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(50);
