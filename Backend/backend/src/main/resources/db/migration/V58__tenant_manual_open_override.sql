-- Manual open/close override flag. When an admin (or the AI) toggles the store open/closed, the
-- StoreHoursScheduler must respect that instead of reverting it on the next 60s tick (which it did,
-- silently cancelling the admin's action and gating customers at checkout). The scheduler enforces
-- the weekly hours only while this is false; once set, it leaves isOpen alone and resumes auto
-- open/close after the schedule next agrees with the override.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS manual_open_override BOOLEAN NOT NULL DEFAULT false;
