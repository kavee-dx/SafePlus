CREATE TABLE district_officers (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    officer_id VARCHAR(30) NOT NULL UNIQUE,
    assigned_district VARCHAR(80) NOT NULL,
    divisional_secretariats VARCHAR(200),
    clearance_level VARCHAR(40) NOT NULL,
    duty_phone_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
