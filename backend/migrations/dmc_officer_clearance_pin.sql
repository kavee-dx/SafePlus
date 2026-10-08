-- Operational clearance PIN for DMC officers.
-- Officers set their own PIN; only a bcrypt hash is stored, with no default value,
-- so an officer who has never set a PIN simply cannot broadcast.

ALTER TABLE dmc_officers
    ADD COLUMN clearance_pin_hash TEXT,
    ADD COLUMN pin_updated_at TIMESTAMPTZ;
