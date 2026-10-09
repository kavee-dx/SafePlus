-- Alert targets: how the warning service decides who actually receives a broadcast.
-- Citizens self-report a district at registration; the app can also push a live GPS
-- fix and a push token so polygon containment and mobile delivery are real.

ALTER TABLE users
    ADD COLUMN device_token TEXT,
    ADD COLUMN latitude DECIMAL(10, 8),
    ADD COLUMN longitude DECIMAL(11, 8),
    ADD COLUMN location_captured_at TIMESTAMPTZ,
    ADD CONSTRAINT users_coordinate_pair_check
        CHECK ((latitude IS NULL) = (longitude IS NULL));

-- Audience resolution is always "active accounts in this district".
CREATE INDEX users_alert_audience_idx ON users (district, status);
CREATE INDEX users_device_token_idx ON users (device_token)
    WHERE device_token IS NOT NULL;
