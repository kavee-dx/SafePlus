-- UC-01 / Issue Location-Based Disaster Warning
-- Ground reports raised by citizens, DMC verification queue, and officer notifications.

CREATE TABLE hazard_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id VARCHAR(50) NOT NULL UNIQUE,
    reporter_id UUID REFERENCES users (id) ON DELETE SET NULL,
    hazard_type VARCHAR(60) NOT NULL,
    severity_level VARCHAR(20) NOT NULL,
    location_district VARCHAR(80) NOT NULL,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    description TEXT NOT NULL,
    affected_population INTEGER,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    verified_by UUID REFERENCES users (id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT hazard_reports_status_check
        CHECK (status IN ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'RESOLVED')),
    CONSTRAINT hazard_reports_severity_check
        CHECK (severity_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT hazard_reports_hazard_type_check
        CHECK (hazard_type IN (
            'FLOOD', 'LANDSLIDE', 'TSUNAMI', 'CYCLONE', 'HEAVY_RAIN', 'STRONG_WIND',
            'LIGHTNING', 'DROUGHT', 'WILDFIRE', 'COASTAL_EROSION', 'LANDSLIDE_RISK',
            'EPIDEMIC', 'INDUSTRIAL_ACCIDENT', 'OTHER'
        )),
    -- A coordinate is either a full pair or absent; half a location is meaningless.
    CONSTRAINT hazard_reports_coordinate_pair_check
        CHECK ((location_lat IS NULL) = (location_lng IS NULL)),
    -- The precondition that gates warning creation cannot be faked at row level.
    CONSTRAINT hazard_reports_verified_pair_check
        CHECK (
            status <> 'VERIFIED'
            OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)
        ),
    CONSTRAINT hazard_reports_affected_population_check
        CHECK (affected_population IS NULL OR affected_population >= 0)
);

CREATE TABLE report_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES hazard_reports (id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    related_report_id UUID REFERENCES hazard_reports (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notifications_type_check
        CHECK (type IN ('REPORT_SUBMITTED', 'REPORT_VERIFIED', 'REPORT_REJECTED', 'WARNING_CREATED'))
);

CREATE INDEX hazard_reports_status_idx ON hazard_reports (status);
CREATE INDEX hazard_reports_district_idx ON hazard_reports (location_district);
CREATE INDEX hazard_reports_created_idx ON hazard_reports (created_at DESC);
CREATE INDEX report_attachments_report_idx ON report_attachments (report_id);
CREATE INDEX notifications_recipient_idx ON notifications (recipient_id);
CREATE INDEX notifications_unread_idx ON notifications (recipient_id, is_read);
