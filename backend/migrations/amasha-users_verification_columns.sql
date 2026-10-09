ALTER TABLE users
    ADD COLUMN rejection_reason TEXT,
    ADD COLUMN verified_at TIMESTAMPTZ,
    ADD COLUMN verified_by_admin_id UUID REFERENCES super_admins (id) ON DELETE SET NULL;

CREATE INDEX users_status_idx ON users (status);
