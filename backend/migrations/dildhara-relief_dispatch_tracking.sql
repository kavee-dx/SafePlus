-- Dispatch response and tracking history for SafePlus Relief Operations.
-- Safe to run more than once.

ALTER TABLE relief_dispatches
    ADD COLUMN IF NOT EXISTS agency_response VARCHAR(20)
        NOT NULL DEFAULT 'PENDING';

ALTER TABLE relief_dispatches
    ADD COLUMN IF NOT EXISTS agency_response_notes TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'relief_dispatches_agency_response_check'
    ) THEN
        ALTER TABLE relief_dispatches
            ADD CONSTRAINT relief_dispatches_agency_response_check
            CHECK (agency_response IN (
                'PENDING', 'ACCEPTED', 'REJECTED'
            ));
    END IF;
END $$;

-- Permit an initial dispatch plan before a specific vehicle is assigned.
ALTER TABLE relief_dispatch_assignments
    ALTER COLUMN vehicle_id DROP NOT NULL;

-- Timestamped reports; these are recorded reports, not automatic GPS.
CREATE TABLE IF NOT EXISTS relief_dispatch_tracking (
    id UUID PRIMARY KEY,
    dispatch_id UUID NOT NULL
        REFERENCES relief_dispatches(id) ON DELETE CASCADE,
    reported_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL
        CHECK (status IN (
            'PLANNED', 'READY', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'
        )),
    location_label TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    notes TEXT,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT relief_dispatch_tracking_latitude_check
        CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT relief_dispatch_tracking_longitude_check
        CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS relief_dispatch_tracking_dispatch_time_idx
    ON relief_dispatch_tracking (dispatch_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS relief_dispatches_status_idx
    ON relief_dispatches (status);
