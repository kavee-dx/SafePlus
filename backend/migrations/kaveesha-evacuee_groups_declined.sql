-- A team leader can now decline the shelter plan the district assigned (the beds
-- do not work for them — wrong side of the flood, no capacity for a vulnerable
-- member, etc.). Declining frees the reservations and hands the group back to the
-- officer to reassign, so "DECLINED" is a distinct, still-open state rather than
-- a silent drop back to AWAITING_SHELTER that the officer could not tell apart
-- from a request nobody had acted on yet.

ALTER TABLE evacuee_groups
    DROP CONSTRAINT IF EXISTS evacuee_groups_status_check;

ALTER TABLE evacuee_groups
    ADD CONSTRAINT evacuee_groups_status_check
    CHECK (status IN (
        'AWAITING_SHELTER', 'ALLOCATED', 'IN_TRANSIT',
        'ARRIVAL_REPORTED', 'ARRIVED', 'PARTIAL', 'CANCELLED', 'DECLINED'
    ));
