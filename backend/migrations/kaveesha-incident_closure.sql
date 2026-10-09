-- UC-03, the closing line of an incident.
--
-- The acceptance row says a district took an incident on. This says the same
-- district has finished with it: everyone came back, the numbers are in, and the
-- desk can move it out of the active queue.
--
-- It stays on the acceptance row on purpose. The office that opened the incident
-- is the office that shuts it, and the DMC's verification row is still never
-- touched from here — that gate belongs to its own owner.

ALTER TABLE district_incident_acceptance
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resolution_note TEXT;

-- A closure that cannot say who stamped it is worthless on an audit, so the pair
-- is held here rather than trusted to the application.
ALTER TABLE district_incident_acceptance
    DROP CONSTRAINT IF EXISTS district_incident_acceptance_closure_pair_check,
    ADD CONSTRAINT district_incident_acceptance_closure_pair_check
        CHECK (resolved_at IS NULL OR resolved_by IS NOT NULL);

-- The desk keeps its closed incidents readable, so the finished pile is searched
-- by when it finished, not by when it started.
CREATE INDEX IF NOT EXISTS district_incident_closure_idx
    ON district_incident_acceptance (resolved_at DESC)
    WHERE resolved_at IS NOT NULL;
