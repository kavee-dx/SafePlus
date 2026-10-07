CREATE TABLE organization_admins (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    organization_name VARCHAR(150) NOT NULL,
    organization_type VARCHAR(60) NOT NULL,
    registration_number VARCHAR(60) NOT NULL UNIQUE,
    contact_person VARCHAR(150) NOT NULL,
    contact_phone_number VARCHAR(20) NOT NULL,
    address TEXT,
    district VARCHAR(80) NOT NULL,
    operating_area VARCHAR(150),
    rescue_team_count INTEGER NOT NULL CHECK (rescue_team_count >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
