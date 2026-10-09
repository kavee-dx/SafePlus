CREATE TABLE resource_requests (
    id UUID PRIMARY KEY,
    requester_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    resource_type VARCHAR(100) NOT NULL,
    resource_name VARCHAR(150) NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit VARCHAR(50) NOT NULL,
    urgency VARCHAR(20) NOT NULL
        CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    required_date DATE,
    location TEXT NOT NULL,
    district VARCHAR(80) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX resource_requests_requester_created_idx
    ON resource_requests (requester_user_id, created_at DESC);

CREATE INDEX resource_requests_status_district_idx
    ON resource_requests (status, district);
