-- UC-02 Submit & Verify Incident Ground Report
-- Extends the ground-report tables with the fields and lifecycle the use case
-- needs: date/time observed, landmark, immediate-danger flag, evidence
-- attachments, and the "additional information required" round-trip.

-- 1. A report can now sit in ADDITIONAL_INFO_REQUIRED while the citizen is
--    asked to supply more evidence or detail before it returns to the queue.
ALTER TABLE hazard_reports DROP CONSTRAINT hazard_reports_status_check;
ALTER TABLE hazard_reports
    ADD CONSTRAINT hazard_reports_status_check
    CHECK (status IN (
        'PENDING_VERIFICATION', 'ADDITIONAL_INFO_REQUIRED', 'VERIFIED',
        'REJECTED', 'RESOLVED'
    ));

-- 2. Extra columns captured by the multi-step citizen form and the A2 flow.
ALTER TABLE hazard_reports
    ADD COLUMN observed_at TIMESTAMPTZ,
    ADD COLUMN landmark TEXT,
    ADD COLUMN immediate_danger BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN info_request_reason TEXT,
    ADD COLUMN info_requested_by UUID REFERENCES users (id) ON DELETE SET NULL,
    ADD COLUMN info_requested_at TIMESTAMPTZ;

CREATE INDEX hazard_reports_info_required_idx
    ON hazard_reports (status)
    WHERE status = 'ADDITIONAL_INFO_REQUIRED';

-- 3. Officers asking for more information notify the reporter with a distinct
--    type so the citizen app can surface the reason.
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'REPORT_SUBMITTED', 'REPORT_VERIFIED', 'REPORT_REJECTED',
        'REPORT_INFO_REQUESTED', 'WARNING_CREATED'
    ));

-- 4. Evidence rows distinguish a photo from a video and keep the mime type so
--    the portal can render each attachment correctly.
ALTER TABLE report_attachments
    ADD COLUMN file_kind VARCHAR(20) NOT NULL DEFAULT 'PHOTO',
    ADD COLUMN content_type VARCHAR(80);

CREATE INDEX report_attachments_kind_idx ON report_attachments (report_id, file_kind);
