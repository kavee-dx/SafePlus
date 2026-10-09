-- UC-03 Dispatch Rescue Team (Member 3, step 1).
-- A verified hazard report is the incident; this stores the tasking of a rescue
-- team onto it, plus the stage trail that the officer timeline reads.

CREATE TABLE rescue_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- What the officer and the team leader read out to each other by phone.
    dispatch_code VARCHAR(24) NOT NULL UNIQUE,
    report_id UUID NOT NULL REFERENCES hazard_reports (id) ON DELETE CASCADE,
    -- RESTRICT, not CASCADE: mission history outlives a team being removed.
    team_id UUID NOT NULL REFERENCES team_leaders (id) ON DELETE RESTRICT,
    dispatched_by UUID REFERENCES users (id) ON DELETE SET NULL,
    -- Snapshot of the incident district so a district officer's live list is a
    -- single indexed filter instead of a join through hazard reports.
    district VARCHAR(80) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'DISPATCHED',
    mission_notes TEXT,
    -- The recommendation is ephemeral, but why the officer chose a team is not.
    recommendation_score NUMERIC(5, 2),
    recommendation_factors JSONB,
    -- Filled at completion; this is the demand figure shelters will consume.
    people_rescued INTEGER,
    people_evacuated INTEGER,
    decline_reason TEXT,
    cancel_reason TEXT,
    accepted_at TIMESTAMPTZ,
    en_route_at TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    rescue_started_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rescue_dispatches_status_check
        CHECK (status IN (
            'DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'RESCUE_IN_PROGRESS',
            'RETURNING', 'COMPLETED', 'DECLINED', 'CANCELLED'
        )),
    CONSTRAINT rescue_dispatches_people_rescued_check
        CHECK (people_rescued IS NULL OR people_rescued >= 0),
    CONSTRAINT rescue_dispatches_people_evacuated_check
        CHECK (people_evacuated IS NULL OR people_evacuated >= 0),
    -- A stage timestamp only exists once the mission really reached that stage,
    -- so the trail cannot be edited into a story that never happened. A mission
    -- stood down before acceptance legitimately keeps no accepted_at.
    CONSTRAINT rescue_dispatches_stage_coherence_check
        CHECK (
            (en_route_at IS NULL OR accepted_at IS NOT NULL)
            AND (arrived_at IS NULL OR en_route_at IS NOT NULL)
            AND (rescue_started_at IS NULL OR arrived_at IS NOT NULL)
            AND (returned_at IS NULL OR arrived_at IS NOT NULL)
            AND (completed_at IS NOT NULL) = (status = 'COMPLETED')
            AND (declined_at IS NOT NULL) = (status = 'DECLINED')
            AND (cancelled_at IS NOT NULL) = (status = 'CANCELLED')
            AND (accepted_at IS NOT NULL OR status IN ('DISPATCHED', 'DECLINED', 'CANCELLED'))
        )
);

-- One team cannot hold two live missions. Enforced here, not in the app.
CREATE UNIQUE INDEX rescue_dispatches_one_live_per_team_idx
    ON rescue_dispatches (team_id)
    WHERE status IN ('DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED',
                     'RESCUE_IN_PROGRESS', 'RETURNING');

CREATE INDEX rescue_dispatches_report_idx ON rescue_dispatches (report_id);
CREATE INDEX rescue_dispatches_team_idx ON rescue_dispatches (team_id, status);
CREATE INDEX rescue_dispatches_district_live_idx
    ON rescue_dispatches (district, status)
    WHERE status IN ('DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED',
                     'RESCUE_IN_PROGRESS', 'RETURNING');
CREATE INDEX rescue_dispatches_created_idx ON rescue_dispatches (created_at DESC);

CREATE TABLE rescue_dispatch_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID NOT NULL REFERENCES rescue_dispatches (id) ON DELETE CASCADE,
    -- NULL on the row that records the dispatch itself.
    from_status VARCHAR(24),
    to_status VARCHAR(24) NOT NULL,
    actor_id UUID REFERENCES users (id) ON DELETE SET NULL,
    -- Stored as text on purpose: a role renaming must not rewrite history.
    actor_role VARCHAR(40),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rescue_dispatch_events_to_status_check
        CHECK (to_status IN (
            'DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'RESCUE_IN_PROGRESS',
            'RETURNING', 'COMPLETED', 'DECLINED', 'CANCELLED'
        )),
    CONSTRAINT rescue_dispatch_events_from_status_check
        CHECK (from_status IS NULL OR from_status IN (
            'DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'RESCUE_IN_PROGRESS',
            'RETURNING', 'COMPLETED', 'DECLINED', 'CANCELLED'
        ))
);

CREATE INDEX rescue_dispatch_events_dispatch_idx
    ON rescue_dispatch_events (dispatch_id, created_at ASC);
