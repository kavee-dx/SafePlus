
CREATE TABLE relief_vehicles (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    owner_type VARCHAR(20) NOT NULL
        CHECK (owner_type IN (
            'INDIVIDUAL',
            'TEAM',
            'ORGANIZATION',
            'GOVERNMENT'
        )),

    volunteer_profile_id UUID
        REFERENCES delivery_volunteers(id) ON DELETE RESTRICT,

    team_profile_id UUID
        REFERENCES delivery_volunteer_teams(id) ON DELETE RESTRICT,

    vehicle_registration_number VARCHAR(30) NOT NULL UNIQUE,
    vehicle_type VARCHAR(50) NOT NULL,

    max_payload_kg NUMERIC(12, 2)
        CHECK (max_payload_kg IS NULL OR max_payload_kg > 0),

    cargo_volume_m3 NUMERIC(12, 3)
        CHECK (cargo_volume_m3 IS NULL OR cargo_volume_m3 > 0),

    driver_name VARCHAR(150),
    driver_phone VARCHAR(20),
    driving_license_number VARCHAR(40),

    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN (
            'AVAILABLE',
            'UNAVAILABLE',
            'MAINTENANCE',
            'RETIRED'
        )),

    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX relief_vehicles_owner_idx
    ON relief_vehicles(owner_user_id);

CREATE INDEX relief_vehicles_status_idx
    ON relief_vehicles(status);


CREATE TABLE relief_allocations (
    id UUID PRIMARY KEY,

    allocation_type VARCHAR(10) NOT NULL
        CHECK (allocation_type IN ('REQUEST', 'AREA')),

    request_id UUID
        REFERENCES resource_requests(id) ON DELETE RESTRICT,

    destination_name VARCHAR(200),
    destination_location TEXT NOT NULL,
    destination_district VARCHAR(80) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN (
            'DRAFT',
            'RESERVED',
            'DISPATCHED',
            'COMPLETED',
            'CANCELLED'
        )),

    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT relief_allocations_target_check CHECK (
        (allocation_type = 'REQUEST' AND request_id IS NOT NULL)
        OR
        (allocation_type = 'AREA' AND request_id IS NULL)
    )
);

CREATE INDEX relief_allocations_request_idx
    ON relief_allocations(request_id);

CREATE INDEX relief_allocations_status_idx
    ON relief_allocations(status);

CREATE INDEX relief_allocations_district_idx
    ON relief_allocations(destination_district);


CREATE TABLE relief_allocation_items (
    id UUID PRIMARY KEY,

    allocation_id UUID NOT NULL
        REFERENCES relief_allocations(id) ON DELETE RESTRICT,

    resource_id UUID NOT NULL
        REFERENCES relief_resources(id) ON DELETE RESTRICT,

    quantity NUMERIC(12, 2) NOT NULL
        CHECK (quantity > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT relief_allocation_items_unique_resource
        UNIQUE (allocation_id, resource_id),

    CONSTRAINT relief_allocation_items_unique_id_resource
        UNIQUE (id, resource_id)
);

CREATE INDEX relief_allocation_items_resource_idx
    ON relief_allocation_items(resource_id);


CREATE TABLE relief_dispatches (
    id UUID PRIMARY KEY,

    allocation_id UUID NOT NULL
        REFERENCES relief_allocations(id) ON DELETE RESTRICT,

    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED'
        CHECK (status IN (
            'PLANNED',
            'READY',
            'IN_TRANSIT',
            'DELIVERED',
            'CANCELLED'
        )),

    planned_departure TIMESTAMPTZ,
    actual_departure TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX relief_dispatches_allocation_idx
    ON relief_dispatches(allocation_id);

CREATE INDEX relief_dispatches_status_idx
    ON relief_dispatches(status);


CREATE TABLE relief_dispatch_assignments (
    id UUID PRIMARY KEY,

    dispatch_id UUID NOT NULL
        REFERENCES relief_dispatches(id) ON DELETE RESTRICT,

    vehicle_id UUID NOT NULL
        REFERENCES relief_vehicles(id) ON DELETE RESTRICT,

    trip_number INTEGER NOT NULL DEFAULT 1
        CHECK (trip_number >= 1),

    driver_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,

    volunteer_profile_id UUID
        REFERENCES delivery_volunteers(id) ON DELETE RESTRICT,

    team_profile_id UUID
        REFERENCES delivery_volunteer_teams(id) ON DELETE RESTRICT,

    status VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED'
        CHECK (status IN (
            'ASSIGNED',
            'EN_ROUTE',
            'COMPLETED',
            'CANCELLED'
        )),

    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT relief_dispatch_assignment_trip_unique
        UNIQUE (dispatch_id, vehicle_id, trip_number)
);

CREATE INDEX relief_dispatch_assignments_dispatch_idx
    ON relief_dispatch_assignments(dispatch_id);

CREATE INDEX relief_dispatch_assignments_vehicle_idx
    ON relief_dispatch_assignments(vehicle_id);


CREATE TABLE relief_dispatch_items (
    id UUID PRIMARY KEY,

    assignment_id UUID NOT NULL
        REFERENCES relief_dispatch_assignments(id) ON DELETE RESTRICT,

    allocation_item_id UUID NOT NULL
        REFERENCES relief_allocation_items(id) ON DELETE RESTRICT,

    quantity_dispatched NUMERIC(12, 2) NOT NULL
        CHECK (quantity_dispatched > 0),

    quantity_received NUMERIC(12, 2)
        CHECK (quantity_received IS NULL OR quantity_received >= 0),

    quantity_damaged NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (quantity_damaged >= 0),

    quantity_missing NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (quantity_missing >= 0),

    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT relief_dispatch_item_unique
        UNIQUE (assignment_id, allocation_item_id),

    CONSTRAINT relief_dispatch_item_received_limit CHECK (
        quantity_received IS NULL
        OR quantity_received + quantity_damaged + quantity_missing
            <= quantity_dispatched
    )
);

CREATE INDEX relief_dispatch_items_allocation_item_idx
    ON relief_dispatch_items(allocation_item_id);


CREATE TABLE relief_delivery_confirmations (
    id UUID PRIMARY KEY,

    dispatch_id UUID NOT NULL
        REFERENCES relief_dispatches(id) ON DELETE RESTRICT,

    confirmed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    receiver_name VARCHAR(150),
    receiver_phone VARCHAR(20),

    delivery_condition VARCHAR(20) NOT NULL DEFAULT 'ACCEPTED'
        CHECK (delivery_condition IN (
            'ACCEPTED',
            'PARTIAL',
            'DAMAGED',
            'REJECTED'
        )),

    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX relief_delivery_confirmations_dispatch_idx
    ON relief_delivery_confirmations(dispatch_id);