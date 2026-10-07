CREATE TABLE delivery_volunteers (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    emergency_contact_name VARCHAR(150) NOT NULL,
    emergency_contact_number VARCHAR(20) NOT NULL,
    has_vehicle BOOLEAN NOT NULL DEFAULT FALSE,
    vehicle_registration_number VARCHAR(20),
    vehicle_type VARCHAR(30),
    vehicle_capacity VARCHAR(60),
    driving_license_number VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
