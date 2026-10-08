-- UC-01 / SMS delivery.
-- The SMS channel is only real if the message exists somewhere the citizen can
-- read it, so every dispatched text is stored per recipient and the mobile app
-- renders it as the emergency alert on the handset.

CREATE TABLE alert_sms_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warning_id UUID NOT NULL REFERENCES disaster_warnings (id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Short-code style sender shown above the message, e.g. DMC-ALERT.
    sender_id VARCHAR(20) NOT NULL,
    -- The three lines the wireframe puts on the alert card.
    level_label VARCHAR(60) NOT NULL,
    area_label VARCHAR(120) NOT NULL,
    instruction TEXT NOT NULL,
    -- The exact text handed to the SMSC, trilingual.
    body TEXT NOT NULL,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    -- One SMS per citizen per warning, whatever the retry path.
    CONSTRAINT alert_sms_messages_once_per_recipient UNIQUE (warning_id, recipient_id)
);

CREATE INDEX alert_sms_messages_recipient_idx
    ON alert_sms_messages (recipient_id, delivered_at DESC);
CREATE INDEX alert_sms_messages_unread_idx
    ON alert_sms_messages (recipient_id)
    WHERE read_at IS NULL;
