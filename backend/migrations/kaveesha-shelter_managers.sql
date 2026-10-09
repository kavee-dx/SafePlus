-- Shelter Manager, the field operator who runs one or more shelters.
-- A Shelter Manager is an account like any other (a row in users with role
-- SHELTER_MANAGER), created by the District Officer. This table is the shelter
-- side of that identity, and the join below is what authorizes a manager over a
-- specific shelter — a manager can only ever act on shelters they are assigned.

CREATE TABLE shelter_managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UNIQUE: exactly one shelter-manager profile per login account.
    user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    full_name VARCHAR(160) NOT NULL,
    phone_number VARCHAR(24),
    designation VARCHAR(120),
    district VARCHAR(80) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX shelter_managers_user_idx ON shelter_managers (user_id);
CREATE INDEX shelter_managers_district_idx ON shelter_managers (district);

CREATE TABLE shelter_manager_assignments (
    manager_id UUID NOT NULL REFERENCES shelter_managers (id) ON DELETE CASCADE,
    shelter_id UUID NOT NULL REFERENCES shelters (id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One manager may hold many shelters; a shelter-manager pair is unique.
    PRIMARY KEY (manager_id, shelter_id)
);

CREATE INDEX shelter_manager_assignments_shelter_idx
    ON shelter_manager_assignments (shelter_id);
