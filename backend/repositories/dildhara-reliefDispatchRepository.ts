import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import pool from "../config/db";
import { ApiError } from "../utils/apiError";

type DispatchStatus =
  | "PLANNED"
  | "READY"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

type AgencyResponse = "PENDING" | "ACCEPTED" | "REJECTED";

interface AssignmentItemInput {
  allocationItemId: string;
  quantityDispatched: number;
}

interface AssignmentInput {
  vehicleId?: string | null;
  driverUserId?: string | null;
  volunteerProfileId?: string | null;
  teamProfileId?: string | null;
  tripNumber: number;
  notes?: string | null;
  items: AssignmentItemInput[];
}

interface DeliveryItemInput {
  dispatchItemId: string;
  quantityReceived: number;
  quantityDamaged: number;
  quantityMissing: number;
}

async function rollbackAndThrow(
  client: PoolClient,
  error: unknown
): Promise<never> {
  await client.query("ROLLBACK");
  throw error;
}

export async function createDispatch(
  allocationId: string,
  userId: string,
  plannedDeparture?: string | null,
  notes?: string | null
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const allocationResult = await client.query(
      `SELECT id, status
       FROM relief_allocations
       WHERE id = $1
       FOR UPDATE`,
      [allocationId]
    );

    if (allocationResult.rowCount === 0) {
      throw new ApiError(404, "Allocation not found.");
    }

    if (allocationResult.rows[0].status !== "RESERVED") {
      throw new ApiError(
        409,
        "Only reserved allocations can be dispatched."
      );
    }

    const existing = await client.query(
      `SELECT id
       FROM relief_dispatches
       WHERE allocation_id = $1
         AND status <> 'CANCELLED'
       LIMIT 1`,
      [allocationId]
    );

    if (existing.rowCount) {
      throw new ApiError(
        409,
        "An active dispatch already exists for this allocation."
      );
    }

    const dispatchId = randomUUID();

    const created = await client.query(
      `INSERT INTO relief_dispatches
         (id, allocation_id, status, planned_departure, created_by, notes)
       VALUES ($1, $2, 'PLANNED', $3, $4, $5)
       RETURNING *`,
      [
        dispatchId,
        allocationId,
        plannedDeparture || null,
        userId,
        notes || null,
      ]
    );

    await client.query(
      `INSERT INTO relief_dispatch_tracking
         (id, dispatch_id, reported_by, status, notes)
       VALUES ($1, $2, $3, 'PLANNED', $4)`,
      [randomUUID(), dispatchId, userId, "Dispatch plan created."]
    );

    await client.query("COMMIT");
    return created.rows[0];
  } catch (error) {
    return rollbackAndThrow(client, error);
  } finally {
    client.release();
  }
}

export async function getDispatch(dispatchId: string) {
  const dispatchResult = await pool.query(
    `SELECT d.*, a.destination_name, a.destination_location,
            a.destination_district, a.allocation_type,
            a.status AS allocation_status
     FROM relief_dispatches d
     JOIN relief_allocations a ON a.id = d.allocation_id
     WHERE d.id = $1`,
    [dispatchId]
  );

  if (dispatchResult.rowCount === 0) {
    throw new ApiError(404, "Dispatch not found.");
  }

  const [assignments, tracking, confirmations] = await Promise.all([
    pool.query(
      `SELECT da.*,
              v.vehicle_registration_number, v.vehicle_type,
              v.max_payload_kg,
              driver.full_name AS driver_name,
              volunteer_user.full_name AS volunteer_name,
              team.team_name
       FROM relief_dispatch_assignments da
       LEFT JOIN relief_vehicles v ON v.id = da.vehicle_id
       LEFT JOIN users driver ON driver.id = da.driver_user_id
       LEFT JOIN delivery_volunteers volunteer
         ON volunteer.id = da.volunteer_profile_id
       LEFT JOIN users volunteer_user ON volunteer_user.id = volunteer.user_id
       LEFT JOIN delivery_volunteer_teams team
         ON team.id = da.team_profile_id
       WHERE da.dispatch_id = $1
       ORDER BY da.trip_number, da.created_at`,
      [dispatchId]
    ),
    pool.query(
      `SELECT *
       FROM relief_dispatch_tracking
       WHERE dispatch_id = $1
       ORDER BY reported_at ASC`,
      [dispatchId]
    ),
    pool.query(
      `SELECT *
       FROM relief_delivery_confirmations
       WHERE dispatch_id = $1
       ORDER BY delivered_at DESC`,
      [dispatchId]
    ),
  ]);

  const assignmentIds = assignments.rows.map(
    (assignment: { id: string }) => assignment.id
  );

  let items: { rows: unknown[] } = { rows: [] };

  if (assignmentIds.length > 0) {
    items = await pool.query(
      `SELECT di.*, ai.resource_id, r.resource_name, r.resource_type,
              r.unit
       FROM relief_dispatch_items di
       JOIN relief_allocation_items ai ON ai.id = di.allocation_item_id
       JOIN relief_resources r ON r.id = ai.resource_id
       WHERE di.assignment_id = ANY($1::uuid[])
       ORDER BY di.created_at`,
      [assignmentIds]
    );
  }

  return {
    ...dispatchResult.rows[0],
    assignments: assignments.rows,
    items: items.rows,
    tracking: tracking.rows,
    deliveryConfirmations: confirmations.rows,
  };
}

export async function listDispatches() {
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM relief_dispatches
     ORDER BY created_at DESC`
  );

  return Promise.all(result.rows.map(({ id }) => getDispatch(id)));
}

export async function listDispatchAssignmentOptions() {
  const [vehicles, volunteers, drivers, teams] = await Promise.all([
    pool.query(
      `SELECT id, vehicle_registration_number, vehicle_type, owner_type
       FROM relief_vehicles
       WHERE status = 'AVAILABLE'
         AND NOT EXISTS (
           SELECT 1
           FROM relief_dispatch_assignments assignment
           JOIN relief_dispatches dispatch
             ON dispatch.id = assignment.dispatch_id
           WHERE assignment.vehicle_id = relief_vehicles.id
             AND assignment.status <> 'CANCELLED'
             AND dispatch.status IN ('PLANNED', 'READY', 'IN_TRANSIT')
         )
       ORDER BY vehicle_registration_number`
    ),
    pool.query(
      `SELECT volunteer.id, volunteer.user_id, users.full_name, users.district
       FROM delivery_volunteers volunteer
       INNER JOIN users ON users.id = volunteer.user_id
       WHERE users.role = 'DELIVERY_VOLUNTEER'
         AND users.is_active = TRUE
         AND users.status = 'ACTIVE'
       ORDER BY users.full_name`
    ),
    pool.query(
      `SELECT volunteer.user_id, users.full_name, users.district
       FROM delivery_volunteers volunteer
       INNER JOIN users ON users.id = volunteer.user_id
       WHERE users.role = 'DELIVERY_VOLUNTEER'
         AND users.is_active = TRUE
         AND users.status = 'ACTIVE'
         AND NULLIF(BTRIM(volunteer.driving_license_number), '') IS NOT NULL
       ORDER BY users.full_name`
    ),
    pool.query(
      `SELECT team.id, team.user_id, team.team_name,
              team.operating_district, users.full_name AS leader_name
       FROM delivery_volunteer_teams team
       INNER JOIN users ON users.id = team.user_id
       WHERE users.role = 'DELIVERY_VOLUNTEER_TEAM'
         AND users.is_active = TRUE
         AND users.status = 'ACTIVE'
       ORDER BY team.team_name`
    ),
  ]);

  return {
    vehicles: vehicles.rows,
    volunteers: volunteers.rows,
    drivers: drivers.rows,
    teams: teams.rows,
  };
}

export async function respondToDispatch(
  dispatchId: string,
  userId: string,
  response: AgencyResponse,
  responseNotes?: string | null
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT *
       FROM relief_dispatches
       WHERE id = $1
       FOR UPDATE`,
      [dispatchId]
    );

    if (!result.rowCount) {
      throw new ApiError(404, "Dispatch not found.");
    }

    const dispatch = result.rows[0];

    if (dispatch.status !== "PLANNED" || dispatch.agency_response !== "PENDING") {
      throw new ApiError(
        409,
        "This dispatch has already received a response or progressed."
      );
    }

    if (response === "REJECTED") {
      await client.query(
        `UPDATE relief_dispatches
         SET agency_response = 'REJECTED',
             agency_response_notes = $2,
             status = 'CANCELLED',
             updated_at = NOW()
         WHERE id = $1`,
        [dispatchId, responseNotes || null]
      );

      await client.query(
        `UPDATE relief_allocations
         SET status = 'CANCELLED', updated_at = NOW()
         WHERE id = $1 AND status = 'RESERVED'`,
        [dispatch.allocation_id]
      );

      await client.query(
        `INSERT INTO relief_dispatch_tracking
           (id, dispatch_id, reported_by, status, notes)
         VALUES ($1, $2, $3, 'CANCELLED', $4)`,
        [
          randomUUID(),
          dispatchId,
          userId,
          responseNotes || "Agency rejected the dispatch.",
        ]
      );
    } else {
      await client.query(
        `UPDATE relief_dispatches
         SET agency_response = 'ACCEPTED',
             agency_response_notes = $2,
             status = 'READY',
             updated_at = NOW()
         WHERE id = $1`,
        [dispatchId, responseNotes || null]
      );

      await client.query(
        `INSERT INTO relief_dispatch_tracking
           (id, dispatch_id, reported_by, status, notes)
         VALUES ($1, $2, $3, 'READY', $4)`,
        [randomUUID(), dispatchId, userId, responseNotes || "Dispatch accepted."]
      );
    }

    await client.query("COMMIT");
    return getDispatch(dispatchId);
  } catch (error) {
    return rollbackAndThrow(client, error);
  } finally {
    client.release();
  }
}

export async function createAssignment(
  dispatchId: string,
  input: AssignmentInput
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT d.*, a.id AS allocation_id
       FROM relief_dispatches d
       JOIN relief_allocations a ON a.id = d.allocation_id
       WHERE d.id = $1
       FOR UPDATE OF d`,
      [dispatchId]
    );

    if (!result.rowCount) {
      throw new ApiError(404, "Dispatch not found.");
    }

    const dispatch = result.rows[0];

    if (!["PLANNED", "READY"].includes(dispatch.status)) {
      throw new ApiError(
        409,
        "Assignments can only be added before the dispatch departs."
      );
    }

    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new ApiError(
        400,
        "Add at least one allocation item to the trip."
      );
    }

    if (
      !input.vehicleId &&
      !input.driverUserId &&
      !input.volunteerProfileId &&
      !input.teamProfileId
    ) {
      throw new ApiError(
        400,
        "Assign a vehicle, driver, volunteer, or team."
      );
    }

    if (new Set(input.items.map((item) => item.allocationItemId)).size !== input.items.length) {
      throw new ApiError(400, "Each allocation item can be assigned only once per trip.");
    }

    const tripNumber = Number(input.tripNumber);

    if (!Number.isInteger(tripNumber) || tripNumber < 1) {
      throw new ApiError(400, "Trip number must be a positive integer.");
    }

    if (input.vehicleId) {
      const vehicle = await client.query(
        `SELECT id
         FROM relief_vehicles
         WHERE id = $1 AND status = 'AVAILABLE'
         FOR UPDATE`,
        [input.vehicleId]
      );

      if (!vehicle.rowCount) {
        throw new ApiError(409, "The selected vehicle is not available.");
      }

      const occupied = await client.query(
        `SELECT 1
         FROM relief_dispatch_assignments assignment
         JOIN relief_dispatches other_dispatch
           ON other_dispatch.id = assignment.dispatch_id
         WHERE assignment.vehicle_id = $1
           AND assignment.dispatch_id <> $2
           AND assignment.status <> 'CANCELLED'
           AND other_dispatch.status IN ('PLANNED', 'READY', 'IN_TRANSIT')
         LIMIT 1`,
        [input.vehicleId, dispatchId]
      );

      if (occupied.rowCount) {
        throw new ApiError(409, "The selected vehicle is assigned to another active dispatch.");
      }
    }

    if (input.driverUserId) {
      const driver = await client.query(
        `SELECT users.id
         FROM users
         JOIN delivery_volunteers volunteer ON volunteer.user_id = users.id
         WHERE users.id = $1
           AND users.role = 'DELIVERY_VOLUNTEER'
           AND users.is_active = TRUE
           AND users.status = 'ACTIVE'
           AND NULLIF(BTRIM(volunteer.driving_license_number), '') IS NOT NULL
         FOR UPDATE OF users`,
        [input.driverUserId]
      );

      if (!driver.rowCount) {
        throw new ApiError(400, "The selected driver is not an active delivery volunteer with a registered driving license.");
      }
    }

    if (input.volunteerProfileId) {
      const volunteer = await client.query(
        `SELECT volunteer.id
         FROM delivery_volunteers volunteer
         JOIN users ON users.id = volunteer.user_id
         WHERE volunteer.id = $1
           AND users.role = 'DELIVERY_VOLUNTEER'
           AND users.is_active = TRUE
           AND users.status = 'ACTIVE'
         FOR UPDATE OF volunteer`,
        [input.volunteerProfileId]
      );

      if (!volunteer.rowCount) {
        throw new ApiError(400, "The selected volunteer is not active or is not registered for delivery.");
      }
    }

    if (input.teamProfileId) {
      const team = await client.query(
        `SELECT team.id
         FROM delivery_volunteer_teams team
         JOIN users ON users.id = team.user_id
         WHERE team.id = $1
           AND users.role = 'DELIVERY_VOLUNTEER_TEAM'
           AND users.is_active = TRUE
           AND users.status = 'ACTIVE'
         FOR UPDATE OF team`,
        [input.teamProfileId]
      );

      if (!team.rowCount) {
        throw new ApiError(400, "The selected team is not active or is not registered for delivery.");
      }
    }

    const assignmentId = randomUUID();

    const assignment = await client.query(
      `INSERT INTO relief_dispatch_assignments
         (id, dispatch_id, vehicle_id, trip_number, driver_user_id,
          volunteer_profile_id, team_profile_id, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ASSIGNED', $8)
       RETURNING *`,
      [
        assignmentId,
        dispatchId,
        input.vehicleId || null,
        tripNumber,
        input.driverUserId || null,
        input.volunteerProfileId || null,
        input.teamProfileId || null,
        input.notes || null,
      ]
    );

    for (const item of input.items) {
      const quantity = Number(item.quantityDispatched);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new ApiError(400, "Dispatched quantities must be positive.");
      }

      const allocationItem = await client.query(
        `SELECT ai.id, ai.quantity
         FROM relief_allocation_items ai
         WHERE ai.id = $1 AND ai.allocation_id = $2
         FOR UPDATE`,
        [item.allocationItemId, dispatch.allocation_id]
      );

      if (!allocationItem.rowCount) {
        throw new ApiError(
          400,
          "An item does not belong to this dispatch's allocation."
        );
      }

      const alreadyAssigned = await client.query(
        `SELECT COALESCE(SUM(di.quantity_dispatched), 0) AS total
         FROM relief_dispatch_items di
         JOIN relief_dispatch_assignments da ON da.id = di.assignment_id
         WHERE da.dispatch_id = $1
           AND di.allocation_item_id = $2`,
        [dispatchId, item.allocationItemId]
      );

      const assignedQuantity = Number(alreadyAssigned.rows[0].total);
      const allocatedQuantity = Number(allocationItem.rows[0].quantity);

      if (assignedQuantity + quantity > allocatedQuantity) {
        throw new ApiError(
          409,
          "The total dispatched quantity cannot exceed the allocated quantity."
        );
      }

      await client.query(
        `INSERT INTO relief_dispatch_items
           (id, assignment_id, allocation_item_id, quantity_dispatched)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), assignmentId, item.allocationItemId, quantity]
      );
    }

    await client.query("COMMIT");
    return assignment.rows[0];
  } catch (error) {
    return rollbackAndThrow(client, error);
  } finally {
    client.release();
  }
}

export async function updateDispatchStatus(
  dispatchId: string,
  userId: string,
  status: "IN_TRANSIT"
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT *
       FROM relief_dispatches
       WHERE id = $1
       FOR UPDATE`,
      [dispatchId]
    );

    if (!result.rowCount) {
      throw new ApiError(404, "Dispatch not found.");
    }

    const dispatch = result.rows[0];

    if (
      dispatch.status !== "READY" ||
      dispatch.agency_response !== "ACCEPTED"
    ) {
      throw new ApiError(
        409,
        "The agency must accept the dispatch before departure."
      );
    }

    const assignments = await client.query(
      `SELECT id
       FROM relief_dispatch_assignments
       WHERE dispatch_id = $1 AND status <> 'CANCELLED'`,
      [dispatchId]
    );

    if (!assignments.rowCount) {
      throw new ApiError(
        409,
        "Assign at least one trip before marking the dispatch in transit."
      );
    }

    await client.query(
      `UPDATE relief_dispatches
       SET status = 'IN_TRANSIT',
           actual_departure = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [dispatchId]
    );

    await client.query(
      `UPDATE relief_allocations
       SET status = 'DISPATCHED', updated_at = NOW()
       WHERE id = $1 AND status = 'RESERVED'`,
      [dispatch.allocation_id]
    );

    await client.query(
      `UPDATE relief_dispatch_assignments
       SET status = 'EN_ROUTE'
       WHERE dispatch_id = $1 AND status = 'ASSIGNED'`,
      [dispatchId]
    );

    await client.query(
      `INSERT INTO relief_dispatch_tracking
         (id, dispatch_id, reported_by, status, notes)
       VALUES ($1, $2, $3, 'IN_TRANSIT', $4)`,
      [randomUUID(), dispatchId, userId, "Dispatch departure recorded."]
    );

    await client.query("COMMIT");
    return getDispatch(dispatchId);
  } catch (error) {
    return rollbackAndThrow(client, error);
  } finally {
    client.release();
  }
}

export async function addTrackingUpdate(
  dispatchId: string,
  userId: string,
  input: {
    locationLabel?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    notes?: string | null;
  }
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const dispatch = await client.query(
      `SELECT status FROM relief_dispatches WHERE id = $1 FOR UPDATE`,
      [dispatchId]
    );

    if (!dispatch.rowCount) {
      throw new ApiError(404, "Dispatch not found.");
    }

    if (dispatch.rows[0].status !== "IN_TRANSIT") {
      throw new ApiError(409, "Tracking updates require an in-transit dispatch.");
    }

    const latitude =
      input.latitude === undefined || input.latitude === null
        ? null
        : Number(input.latitude);
    const longitude =
      input.longitude === undefined || input.longitude === null
        ? null
        : Number(input.longitude);

    if (
      latitude !== null &&
      (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
    ) {
      throw new ApiError(400, "Latitude must be between -90 and 90.");
    }

    if (
      longitude !== null &&
      (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
    ) {
      throw new ApiError(400, "Longitude must be between -180 and 180.");
    }

    const result = await client.query(
      `INSERT INTO relief_dispatch_tracking
         (id, dispatch_id, reported_by, status, location_label,
          latitude, longitude, notes)
       VALUES ($1, $2, $3, 'IN_TRANSIT', $4, $5, $6, $7)
       RETURNING *`,
      [
        randomUUID(),
        dispatchId,
        userId,
        input.locationLabel || null,
        latitude,
        longitude,
        input.notes || null,
      ]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    return rollbackAndThrow(client, error);
  } finally {
    client.release();
  }
}

export async function confirmDelivery(
  dispatchId: string,
  userId: string,
  input: {
    receiverName: string;
    receiverPhone?: string | null;
    condition: "ACCEPTED" | "PARTIAL" | "DAMAGED" | "REJECTED";
    notes?: string | null;
    items: DeliveryItemInput[];
  }
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT *
       FROM relief_dispatches
       WHERE id = $1
       FOR UPDATE`,
      [dispatchId]
    );

    if (!result.rowCount) {
      throw new ApiError(404, "Dispatch not found.");
    }

    const dispatch = result.rows[0];

    if (dispatch.status !== "IN_TRANSIT") {
      throw new ApiError(
        409,
        "Delivery can only be confirmed for an in-transit dispatch."
      );
    }

    if (!input.receiverName?.trim()) {
      throw new ApiError(400, "Receiver name is required.");
    }

    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new ApiError(400, "Provide delivery quantities for the dispatched items.");
    }

    if (
      new Set(input.items.map((item) => item.dispatchItemId)).size !==
      input.items.length
    ) {
      throw new ApiError(400, "Each dispatched item must be confirmed only once.");
    }

    const dispatchItems = await client.query(
      `SELECT di.id
       FROM relief_dispatch_items di
       JOIN relief_dispatch_assignments da ON da.id = di.assignment_id
       WHERE da.dispatch_id = $1`,
      [dispatchId]
    );

    if (
      dispatchItems.rowCount !== input.items.length ||
      dispatchItems.rows.some(
        (row: { id: string }) =>
          !input.items.some((item) => item.dispatchItemId === row.id)
      )
    ) {
      throw new ApiError(
        400,
        "Confirm quantities for every dispatched item before finalizing delivery."
      );
    }

    for (const item of input.items) {
      const received = Number(item.quantityReceived);
      const damaged = Number(item.quantityDamaged);
      const missing = Number(item.quantityMissing);

      if (
        ![received, damaged, missing].every(Number.isFinite) ||
        [received, damaged, missing].some((quantity) => quantity < 0)
      ) {
        throw new ApiError(400, "Delivery quantities must be zero or greater.");
      }

      const dispatchItem = await client.query(
        `SELECT di.id, di.quantity_dispatched, da.dispatch_id
         FROM relief_dispatch_items di
         JOIN relief_dispatch_assignments da ON da.id = di.assignment_id
         WHERE di.id = $1 AND da.dispatch_id = $2
         FOR UPDATE OF di`,
        [item.dispatchItemId, dispatchId]
      );

      if (!dispatchItem.rowCount) {
        throw new ApiError(400, "A delivery item does not belong to this dispatch.");
      }

      const dispatched = Number(dispatchItem.rows[0].quantity_dispatched);
      const accountedFor = received + damaged + missing;

      if (accountedFor > dispatched + 1e-8) {
        throw new ApiError(
          400,
          "Received, damaged, and missing quantities cannot exceed the dispatched quantity."
        );
      }

      if (Math.abs(accountedFor - dispatched) > 1e-8) {
        throw new ApiError(
          400,
          "Received, damaged, and missing quantities must account for the full dispatched quantity."
        );
      }

      await client.query(
        `UPDATE relief_dispatch_items
         SET quantity_received = $2,
             quantity_damaged = $3,
             quantity_missing = $4
         WHERE id = $1`,
        [item.dispatchItemId, received, damaged, missing]
      );
    }

    await client.query(
      `INSERT INTO relief_delivery_confirmations
         (id, dispatch_id, confirmed_by, receiver_name, receiver_phone,
          delivery_condition, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        dispatchId,
        userId,
        input.receiverName.trim(),
        input.receiverPhone || null,
        input.condition,
        input.notes || null,
      ]
    );

    const incompleteItems = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM relief_dispatch_items di
       JOIN relief_dispatch_assignments da ON da.id = di.assignment_id
       WHERE da.dispatch_id = $1
         AND (
           di.quantity_received IS NULL
           OR di.quantity_damaged IS NULL
           OR di.quantity_missing IS NULL
         )`,
      [dispatchId]
    );

    if (incompleteItems.rows[0].count > 0) {
      throw new ApiError(
        400,
        "Confirm quantities for every dispatched item before finalizing delivery."
      );
    }

    const deliveryTotals = await client.query(
      `SELECT ai.id AS allocation_item_id,
              ai.quantity AS allocated_quantity,
              COALESCE(SUM(di.quantity_received), 0) AS received_quantity
       FROM relief_allocation_items ai
       LEFT JOIN relief_dispatch_assignments da
         ON da.dispatch_id = $2
       LEFT JOIN relief_dispatch_items di
         ON di.assignment_id = da.id
        AND di.allocation_item_id = ai.id
       WHERE ai.allocation_id = $1
       GROUP BY ai.id, ai.quantity`,
      [dispatch.allocation_id, dispatchId]
    );

    const fullyReceived = deliveryTotals.rows.every(
      (row: { allocated_quantity: string; received_quantity: string }) =>
        Number(row.received_quantity) >= Number(row.allocated_quantity)
    );

    await client.query(
      `UPDATE relief_dispatches
       SET status = 'DELIVERED', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [dispatchId]
    );

    await client.query(
      `UPDATE relief_dispatch_assignments
       SET status = 'COMPLETED'
       WHERE dispatch_id = $1 AND status <> 'CANCELLED'`,
      [dispatchId]
    );

    if (fullyReceived) {
      await client.query(
        `UPDATE relief_allocations
         SET status = 'COMPLETED', updated_at = NOW()
         WHERE id = $1`,
        [dispatch.allocation_id]
      );
    }

    await client.query(
      `INSERT INTO relief_dispatch_tracking
         (id, dispatch_id, reported_by, status, notes)
       VALUES ($1, $2, $3, 'DELIVERED', $4)`,
      [
        randomUUID(),
        dispatchId,
        userId,
        fullyReceived
          ? "Delivery confirmed in full."
          : "Delivery recorded; some allocated quantities remain outstanding.",
      ]
    );

    await client.query("COMMIT");
    return getDispatch(dispatchId);
  } catch (error) {
    return rollbackAndThrow(client, error);
  } finally {
    client.release();
  }
}