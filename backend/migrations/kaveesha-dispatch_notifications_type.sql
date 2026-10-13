-- When the district board tasks a team, or stands a mission down, the message has
-- to reach the leader's phone and STAY there — not just flash a push that fades.
-- The mobile leader app reads the same notifications feed the portal bell uses, so
-- the CHECK constraint on that shared table needs two leader kinds of its own.
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'REPORT_SUBMITTED', 'REPORT_VERIFIED', 'REPORT_REJECTED',
        'REPORT_INFO_REQUESTED', 'WARNING_CREATED',
        'TEAM_TASKED', 'MISSION_STOOD_DOWN'
    ));
