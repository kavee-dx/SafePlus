-- UC-01 / Issue Location-Based Disaster Warning
-- Warnings, target geometry, trilingual payloads, per-channel delivery and the audit trail.

CREATE TABLE disaster_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warning_id VARCHAR(50) NOT NULL UNIQUE,
    -- A warning may only exist on top of a verified ground report.
    report_id UUID NOT NULL REFERENCES hazard_reports (id),
    hazard_type VARCHAR(60) NOT NULL,
    severity_level VARCHAR(20) NOT NULL,
    target_district VARCHAR(80) NOT NULL,
    safety_instructions TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    english_message TEXT NOT NULL,
    sinhala_message TEXT NOT NULL,
    tamil_message TEXT NOT NULL,
    channels_push BOOLEAN NOT NULL DEFAULT TRUE,
    channels_sms BOOLEAN NOT NULL DEFAULT TRUE,
    channels_siren BOOLEAN NOT NULL DEFAULT FALSE,
    officer_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    audience_count INTEGER NOT NULL DEFAULT 0,
    sms_recipient_count INTEGER NOT NULL DEFAULT 0,
    estimated_reach DECIMAL(5, 2),
    start_time TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    broadcast_at TIMESTAMPTZ,
    CONSTRAINT disaster_warnings_status_check
        CHECK (status IN ('DRAFT', 'PENDING_DISPATCH', 'ACTIVE', 'EXPIRED', 'STOOD_DOWN')),
    CONSTRAINT disaster_warnings_severity_check
        CHECK (severity_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT disaster_warnings_audience_check
        CHECK (audience_count >= 0 AND sms_recipient_count >= 0)
);

CREATE TABLE gis_polygons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warning_id UUID NOT NULL REFERENCES disaster_warnings (id) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL,
    coordinates JSONB NOT NULL,
    area_sq_km DECIMAL(10, 2),
    district_overlap_ratio DECIMAL(5, 4),
    is_valid BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT gis_polygons_source_check CHECK (source IN ('DISTRICT', 'CUSTOM'))
);

CREATE TABLE alert_payloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warning_id UUID NOT NULL REFERENCES disaster_warnings (id) ON DELETE CASCADE,
    english_text TEXT NOT NULL,
    sinhala_text TEXT NOT NULL,
    tamil_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE broadcast_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warning_id UUID NOT NULL REFERENCES disaster_warnings (id) ON DELETE CASCADE,
    channel_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    target_count INTEGER NOT NULL DEFAULT 0,
    delivery_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    CONSTRAINT broadcast_logs_channel_check
        CHECK (channel_type IN ('push', 'sms', 'siren')),
    CONSTRAINT broadcast_logs_status_check
        CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'PARTIAL'))
);

-- logBroadcastAudit(): written by the asynchronous audit queue, never inline with dispatch.
CREATE TABLE warning_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warning_id VARCHAR(50),
    officer_id UUID REFERENCES users (id) ON DELETE SET NULL,
    action VARCHAR(40) NOT NULL,
    entry_point VARCHAR(60) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT warning_audit_logs_action_check
        CHECK (action IN (
            'DRAFT_CREATED', 'DRAFT_UPDATED', 'DRAFT_DELETED', 'REVIEWED_REPORT',
            'BROADCAST_SUCCESS', 'BROADCAST_FAILED', 'AUTH_FAILED',
            'PIN_SET', 'SMS_FALLBACK', 'STOOD_DOWN', 'NO_COVERAGE'
        ))
);

-- Broadcasts referenced by the officer notification feed now that warnings exist.
ALTER TABLE notifications
    ADD COLUMN related_warning_id UUID REFERENCES disaster_warnings (id) ON DELETE SET NULL;

CREATE INDEX disaster_warnings_status_idx ON disaster_warnings (status);
CREATE INDEX disaster_warnings_officer_idx ON disaster_warnings (officer_id);
CREATE INDEX disaster_warnings_report_idx ON disaster_warnings (report_id);
CREATE INDEX disaster_warnings_district_idx ON disaster_warnings (target_district);
CREATE INDEX gis_polygons_warning_idx ON gis_polygons (warning_id);
CREATE INDEX broadcast_logs_warning_idx ON broadcast_logs (warning_id);
CREATE INDEX warning_audit_logs_warning_idx ON warning_audit_logs (warning_id);
