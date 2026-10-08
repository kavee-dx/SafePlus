CREATE TABLE rescue_organizations (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    organization_name VARCHAR(150) NOT NULL,
    organization_type VARCHAR(60) NOT NULL,
    registration_number VARCHAR(60) NOT NULL UNIQUE,
    district VARCHAR(80) NOT NULL,
    address TEXT NOT NULL,
    official_email VARCHAR(255) NOT NULL,
    official_phone VARCHAR(20) NOT NULL,
    admin_full_name VARCHAR(150) NOT NULL,
    admin_designation VARCHAR(120) NOT NULL,
    admin_email VARCHAR(255) NOT NULL,
    admin_phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX rescue_organizations_district_idx
    ON rescue_organizations (district);

CREATE INDEX rescue_organizations_user_id_idx
    ON rescue_organizations (user_id);
