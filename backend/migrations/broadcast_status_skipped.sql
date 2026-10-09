-- A push broadcast that finds no registered device tokens is not a failed send:
-- the warning is still stored in every targeted account's citizen app inbox.
-- Record that case as SKIPPED so Alert history stops reporting it as FAILED.

ALTER TABLE broadcast_logs
    DROP CONSTRAINT IF EXISTS broadcast_logs_status_check;

ALTER TABLE broadcast_logs
    ADD CONSTRAINT broadcast_logs_status_check
    CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'PARTIAL', 'SKIPPED'));

UPDATE broadcast_logs
   SET status = 'SKIPPED',
       failure_count = 0,
       error_message = 'No phone in the target district had notifications enabled.'
 WHERE channel_type = 'push'
   AND status = 'FAILED'
   AND target_count = 0;
