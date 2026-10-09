-- One line of a shelter allocation: a group's people directed to one shelter.
-- A group that must split across two shelters has two rows here, which is the
-- whole multi-shelter mechanism. Status is the two-stage model:
--   PENDING   reserved space, not yet arrived (counts against allocatable capacity)
--   CONFIRMED the Shelter Manager counted them in; arrived_count raised occupancy
--   CANCELLED  the officer stood the reservation down before arrival

CREATE TABLE shelter_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES evacuee_groups (id) ON DELETE CASCADE,
    shelter_id UUID NOT NULL REFERENCES shelters (id) ON DELETE RESTRICT,
    allocated_count INTEGER NOT NULL CHECK (allocated_count > 0),
    -- People actually counted in on confirmation. Never exceeds what was sent.
    arrived_count INTEGER NOT NULL DEFAULT 0 CHECK (arrived_count >= 0),
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
    allocated_by UUID REFERENCES users (id) ON DELETE SET NULL,
    confirmed_by UUID REFERENCES users (id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    -- When fewer arrived than were allocated, the manager's reason is kept here.
    discrepancy_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT shelter_allocations_arrived_fit_check
        CHECK (arrived_count <= allocated_count),
    -- arrived_count only means anything once the row is CONFIRMED.
    CONSTRAINT shelter_allocations_confirm_coherence_check
        CHECK (arrived_count = 0 OR status = 'CONFIRMED')
);

CREATE INDEX shelter_allocations_group_idx ON shelter_allocations (group_id);
-- Pending reservations per shelter: the pending-arrival sum that reserves capacity.
CREATE INDEX shelter_allocations_shelter_pending_idx
    ON shelter_allocations (shelter_id, status)
    WHERE status = 'PENDING';
