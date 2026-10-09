-- UC-01 follow-up: the officer decides how long a broadcast stays live.
--
-- expires_in_hours is the lifetime chosen when the warning is drafted. The
-- countdown itself starts at broadcast, so a draft that sat in the wizard
-- overnight does not expire the moment citizens receive it.

ALTER TABLE disaster_warnings
    ADD COLUMN IF NOT EXISTS expires_in_hours INTEGER;

ALTER TABLE disaster_warnings
    ADD CONSTRAINT disaster_warnings_lifetime_check
    CHECK (expires_in_hours IS NULL OR (expires_in_hours >= 1 AND expires_in_hours <= 168));

ALTER TABLE warning_audit_logs
    DROP CONSTRAINT IF EXISTS warning_audit_logs_action_check;

ALTER TABLE warning_audit_logs
    ADD CONSTRAINT warning_audit_logs_action_check
    CHECK (action IN (
        'DRAFT_CREATED', 'DRAFT_UPDATED', 'DRAFT_DELETED', 'REVIEWED_REPORT',
        'BROADCAST_SUCCESS', 'BROADCAST_FAILED', 'AUTH_FAILED',
        'PIN_SET', 'SMS_FALLBACK', 'STOOD_DOWN', 'NO_COVERAGE',
        'EXPIRY_EXTENDED', 'WARNING_DELETED'
    ));
