-- Rescue team registration (organization-based and independent/community teams).
-- The existing team_leaders table already stores affiliation and verified_by, so
-- the new form only needs the extra operational columns. Everything stays
-- nullable/defaulted so the earlier team-leader flow keeps working untouched.

ALTER TABLE team_leaders
    ADD COLUMN IF NOT EXISTS team_type VARCHAR(60),
    ADD COLUMN IF NOT EXISTS team_contact_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS leader_designation VARCHAR(120),
    ADD COLUMN IF NOT EXISTS capabilities TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS equipment TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS base_latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS base_longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS base_location_label VARCHAR(180),
    ADD COLUMN IF NOT EXISTS availability VARCHAR(20) NOT NULL DEFAULT 'UNAVAILABLE',
    ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Organizations and district officers list teams by registration number / status.
CREATE INDEX IF NOT EXISTS team_leaders_org_registration_idx
    ON team_leaders (organization_registration_number);

CREATE INDEX IF NOT EXISTS team_leaders_availability_idx
    ON team_leaders (availability);
