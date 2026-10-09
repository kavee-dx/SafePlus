-- UC-03 District incident desk.
--
-- A teammate's UC-02 verification decides whether a citizen report is true. This
-- records the next, different question: has the district office taken the verified
-- incident on as its own job? It is deliberately its own table, so the verification
-- row stays exactly as its owner writes it and nothing here can rewrite the gate.

CREATE TABLE district_incident_acceptance (
    -- One acceptance per incident, for the lifetime of that incident.
    report_id UUID PRIMARY KEY REFERENCES hazard_reports (id) ON DELETE CASCADE,
    -- The officer who took it on. An acceptance that cannot say who is worthless,
    -- so this is required rather than inferred from the last request.
    accepted_by UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- What the control room told itself when accepting: who else was called,
    -- what the district is providing. Read back on the desk and on the board.
    handover_note TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The desk sorts the backlog by how long an accepted incident has been waiting.
CREATE INDEX district_incident_acceptance_time_idx
    ON district_incident_acceptance (accepted_at DESC);
