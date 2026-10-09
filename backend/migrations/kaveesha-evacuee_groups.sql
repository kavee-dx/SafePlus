-- An evacuee group: one set of people who need shelter together.
-- The unit of allocation is a group, not a head count, which is what gives the
-- traceability the design asks for: Incident -> Rescue Team -> Group -> Shelter.
-- A group arrives either by its own (SELF) or with a rescue team (RESCUE_TEAM,
-- born from a completed dispatch). It can be split across several shelters, so
-- occupancy lives on the allocations, not here.

CREATE TABLE evacuee_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_code VARCHAR(24) NOT NULL UNIQUE,
    people_count INTEGER NOT NULL CHECK (people_count > 0),
    vulnerable_count INTEGER NOT NULL DEFAULT 0 CHECK (vulnerable_count >= 0),
    arrival_source VARCHAR(16) NOT NULL
        CHECK (arrival_source IN ('SELF', 'RESCUE_TEAM')),
    district VARCHAR(80) NOT NULL,
    -- Where the people are now: the incident point, or the self-arriving group's GPS.
    origin_latitude NUMERIC(9, 6),
    origin_longitude NUMERIC(9, 6),
    -- The mission that rescued them, when arrival_source is RESCUE_TEAM. Kept as
    -- SET NULL so a group outlives the dispatch record it came from.
    source_dispatch_id UUID REFERENCES rescue_dispatches (id) ON DELETE SET NULL,
    -- The incident they were rescued from, for the full trace.
    incident_report_id UUID REFERENCES hazard_reports (id) ON DELETE SET NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'AWAITING_SHELTER'
        CHECK (status IN (
            'AWAITING_SHELTER', 'ALLOCATED', 'IN_TRANSIT',
            'ARRIVAL_REPORTED', 'ARRIVED', 'PARTIAL', 'CANCELLED'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT evacuee_groups_vulnerable_fit_check
        CHECK (vulnerable_count <= people_count)
);

CREATE INDEX evacuee_groups_district_status_idx ON evacuee_groups (district, status);
CREATE INDEX evacuee_groups_dispatch_idx ON evacuee_groups (source_dispatch_id);
