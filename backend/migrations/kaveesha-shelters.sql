-- Shelter Coordination (Member 3, shelter component).
-- A shelter is a real place with a fixed capacity. confirmed_occupancy is the
-- only truth about how many people are physically inside; it moves ONLY when a
-- Shelter Manager confirms an arrival or records a walk-in / departure. Pending
-- allocations reserve capacity separately (see shelter_allocations), so two
-- officers can never book the same space twice before people actually arrive.

CREATE TABLE shelters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Read out over the phone and shown on every list.
    shelter_code VARCHAR(24) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    -- Snapshot of the district so a district officer's list is one indexed filter.
    district VARCHAR(80) NOT NULL,
    address TEXT,
    -- Stored as plain numbers (the project convention); the geography is built
    -- in-query with ST_SetSRID(ST_MakePoint(longitude, latitude), 4326).
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    max_capacity INTEGER NOT NULL CHECK (max_capacity > 0),
    -- Physically present people. Raised only on confirmation, never on intent.
    confirmed_occupancy INTEGER NOT NULL DEFAULT 0
        CHECK (confirmed_occupancy BETWEEN 0 AND max_capacity),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Optional amenities shown to the officer and citizen. Not a hard filter yet.
    facilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX shelters_district_active_idx ON shelters (district, is_active);
CREATE INDEX shelters_geo_idx ON shelters ((ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography));
