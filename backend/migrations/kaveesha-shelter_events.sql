-- Append-only shelter ledger. Every event that touches occupancy or a reservation
-- writes a line here, so an officer can review (and, by adding a correcting line,
-- overrule) what a Shelter Manager recorded, without any of it being edited away.
-- Rows are never updated or deleted. people_delta is signed: arrivals positive,
-- departures negative, allocations/confirmations carry the head count involved.

CREATE TABLE shelter_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shelter_id UUID NOT NULL REFERENCES shelters (id) ON DELETE CASCADE,
    group_id UUID REFERENCES evacuee_groups (id) ON DELETE SET NULL,
    -- Who did it. Kept as text like the dispatch trail: a role rename must not
    -- rewrite history, and the account may one day be gone.
    actor_id UUID REFERENCES users (id) ON DELETE SET NULL,
    actor_role VARCHAR(40),
    actor_name VARCHAR(160),
    kind VARCHAR(24) NOT NULL
        CHECK (kind IN (
            'WALK_IN', 'ARRIVAL_CONFIRMED', 'DEPARTURE',
            'ADJUSTMENT', 'ALLOCATED', 'CANCELLED'
        )),
    people_delta INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX shelter_events_shelter_idx ON shelter_events (shelter_id, created_at DESC);
CREATE INDEX shelter_events_group_idx ON shelter_events (group_id);
