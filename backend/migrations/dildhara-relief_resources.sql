CREATE TABLE relief_resources (
    id UUID PRIMARY KEY,
    provider_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    resource_type VARCHAR(100) NOT NULL,
    resource_name VARCHAR(150) NOT NULL,
    description TEXT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(50) NOT NULL,
    location TEXT,
    district VARCHAR(80) NOT NULL,
    available_from TIMESTAMPTZ,
    available_until TIMESTAMPTZ,
    expiry_date TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN ('AVAILABLE', 'UNAVAILABLE', 'EXPIRED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT relief_resources_availability_range
        CHECK (
            available_from IS NULL
            OR available_until IS NULL
            OR available_until >= available_from
        )
);

CREATE INDEX relief_resources_provider_created_idx
    ON relief_resources (provider_user_id, created_at DESC);

CREATE INDEX relief_resources_status_expiry_idx
    ON relief_resources (status, expiry_date);
