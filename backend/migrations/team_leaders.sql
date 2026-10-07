CREATE TABLE team_leaders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    affiliation VARCHAR(20) NOT NULL CHECK (affiliation IN ('ORGANIZATION', 'INDEPENDENT')),
    verified_by VARCHAR(30) NOT NULL CHECK (verified_by IN ('SUPER_ADMIN', 'ORGANIZATION_ADMIN')),
    organization_name VARCHAR(150),
    organization_registration_number VARCHAR(60),
    team_name VARCHAR(150) NOT NULL,
    leader_full_name VARCHAR(150) NOT NULL,
    leader_phone_number VARCHAR(20) NOT NULL,
    address TEXT,
    operating_district VARCHAR(80) NOT NULL,
    member_count INTEGER NOT NULL CHECK (member_count >= 1),
    member_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT team_leaders_organization_required
        CHECK (affiliation <> 'ORGANIZATION' OR organization_name IS NOT NULL)
);
