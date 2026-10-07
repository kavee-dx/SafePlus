ALTER TABLE users
    ADD COLUMN username VARCHAR(20) UNIQUE,
    ADD COLUMN nic_number VARCHAR(12) UNIQUE,
    ADD COLUMN date_of_birth DATE,
    ADD COLUMN gender VARCHAR(20),
    ADD COLUMN address TEXT,
    ADD COLUMN city VARCHAR(80),
    ADD COLUMN district VARCHAR(80),
    ADD COLUMN postal_code VARCHAR(10),
    ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION';

CREATE INDEX users_role_status_idx ON users (role, status);
