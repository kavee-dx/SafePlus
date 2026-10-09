-- Deleting an issued warning is audited as WARNING_DELETED, but the live audit
-- table still only accepts the action list recorded before that feature existed
-- (warning_expiry.sql is already applied, so editing it cannot help).

ALTER TABLE warning_audit_logs
    DROP CONSTRAINT IF EXISTS warning_audit_logs_action_check;

ALTER TABLE warning_audit_logs
    ADD CONSTRAINT warning_audit_logs_action_check
    CHECK (action IN (
        'DRAFT_CREATED',
        'DRAFT_UPDATED',
        'DRAFT_DELETED',
        'REVIEWED_REPORT',
        'BROADCAST_SUCCESS',
        'BROADCAST_FAILED',
        'AUTH_FAILED',
        'PIN_SET',
        'SMS_FALLBACK',
        'STOOD_DOWN',
        'NO_COVERAGE',
        'EXPIRY_EXTENDED',
        'WARNING_DELETED'
    ));
