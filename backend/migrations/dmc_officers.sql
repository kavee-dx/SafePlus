CREATE TABLE dmc_officers (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    officer_id VARCHAR(30) NOT NULL UNIQUE,
    designation VARCHAR(100) NOT NULL,
    dmc_office VARCHAR(150) NOT NULL,
    district VARCHAR(80) NOT NULL,
    clearance_info TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
