
import { randomUUID } from "crypto";
import pool from "../config/db";
import { ApiError } from "../utils/apiError";

export interface AllocationItemInput {
  resourceId: string;
  quantity: number;
}

export interface CreateAllocationInput {
  allocationType: "REQUEST" | "AREA";
  requestId?: string;
  destinationName?: string | null;
  destinationLocation: string;
  destinationDistrict: string;
  notes?: string | null;
  items: AllocationItemInput[];
}

export async function listAvailableResources() {
  const result = await pool.query(
    `
      SELECT
        r.id,
        r.provider_user_id,
        r.resource_type,
        r.resource_name,
        r.description,
        r.quantity,
        r.unit,
        r.location,
        r.district,
        r.available_from,
        r.available_until,
        r.expiry_date,
        r.status,
        COALESCE(a.allocated_quantity, 0) AS allocated_quantity,
        GREATEST(
          r.quantity - COALESCE(a.allocated_quantity, 0),
          0
        ) AS available_quantity
      FROM relief_resources r
      LEFT JOIN (
        SELECT
          ai.resource_id,
          SUM(ai.quantity) AS allocated_quantity
        FROM relief_allocation_items ai
        INNER JOIN relief_allocations al
          ON al.id = ai.allocation_id
        WHERE al.status IN ('RESERVED', 'DISPATCHED', 'COMPLETED')
        GROUP BY ai.resource_id
      ) a ON a.resource_id = r.id
      WHERE r.status = 'AVAILABLE'
        AND (r.expiry_date IS NULL OR r.expiry_date >= NOW())
        AND (r.available_from IS NULL OR r.available_from <= NOW())
        AND (r.available_until IS NULL OR r.available_until >= NOW())
      ORDER BY r.expiry_date ASC NULLS LAST, r.created_at ASC
    `
  );

  return result.rows;
}

export async function createDraftAllocation(
  createdBy: string,
  input: CreateAllocationInput
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (input.allocationType === "REQUEST") {
      const requestResult = await client.query(
        `
          SELECT id, status
          FROM resource_requests
          WHERE id = $1
          FOR UPDATE
        `,
        [input.requestId]
      );

      if (requestResult.rowCount === 0) {
        throw new ApiError(404, "Resource request not found.");
      }

      if (requestResult.rows[0].status !== "APPROVED") {
        throw new ApiError(
          400,
          "Only approved resource requests can be allocated."
        );
      }
    }

    const allocationId = randomUUID();

    const allocationResult = await client.query(
      `
        INSERT INTO relief_allocations (
          id,
          allocation_type,
          request_id,
          destination_name,
          destination_location,
          destination_district,
          status,
          notes,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, $8)
        RETURNING *
      `,
      [
        allocationId,
        input.allocationType,
        input.allocationType === "REQUEST"
          ? input.requestId
          : null,
        input.destinationName ?? null,
        input.destinationLocation,
        input.destinationDistrict,
        input.notes ?? null,
        createdBy,
      ]
    );

    for (const item of input.items) {
      const resourceResult = await client.query(
        `SELECT id FROM relief_resources WHERE id = $1`,
        [item.resourceId]
      );

      if (resourceResult.rowCount === 0) {
        throw new ApiError(
          404,
          `Resource not found: ${item.resourceId}`
        );
      }

      await client.query(
        `
          INSERT INTO relief_allocation_items (
            id,
            allocation_id,
            resource_id,
            quantity
          )
          VALUES ($1, $2, $3, $4)
        `,
        [
          randomUUID(),
          allocationId,
          item.resourceId,
          item.quantity,
        ]
      );
    }

    await client.query("COMMIT");
    return allocationResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listAllocations() {
  const result = await pool.query(
    `
      SELECT
        a.*,
        rr.resource_name AS request_resource_name,
        rr.urgency AS request_urgency,
        rr.quantity AS requested_quantity,
        rr.unit AS requested_unit
      FROM relief_allocations a
      LEFT JOIN resource_requests rr
        ON rr.id = a.request_id
      ORDER BY
        a.created_at DESC
    `
  );

  return result.rows;
}

export async function getAllocationById(allocationId: string) {
  const allocationResult = await pool.query(
    `
      SELECT
        a.*,
        rr.resource_name AS request_resource_name,
        rr.urgency AS request_urgency,
        rr.quantity AS requested_quantity,
        rr.unit AS requested_unit
      FROM relief_allocations a
      LEFT JOIN resource_requests rr
        ON rr.id = a.request_id
      WHERE a.id = $1
    `,
    [allocationId]
  );

  if (allocationResult.rowCount === 0) {
    return null;
  }

  const itemsResult = await pool.query(
    `
      SELECT
        ai.id,
        ai.resource_id,
        ai.quantity,
        r.resource_name,
        r.resource_type,
        r.unit,
        r.district AS source_district,
        r.expiry_date
      FROM relief_allocation_items ai
      INNER JOIN relief_resources r
        ON r.id = ai.resource_id
      WHERE ai.allocation_id = $1
      ORDER BY r.expiry_date ASC NULLS LAST
    `,
    [allocationId]
  );

  return {
    ...allocationResult.rows[0],
    items: itemsResult.rows,
  };
}

export async function reserveAllocation(allocationId: string) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const allocationResult = await client.query(
      `
        SELECT *
        FROM relief_allocations
        WHERE id = $1
        FOR UPDATE
      `,
      [allocationId]
    );

    if (allocationResult.rowCount === 0) {
      throw new ApiError(404, "Allocation not found.");
    }

    const allocation = allocationResult.rows[0];

    if (allocation.status !== "DRAFT") {
      throw new ApiError(
        400,
        "Only draft allocations can be reserved."
      );
    }

    if (allocation.allocation_type === "REQUEST") {
      const requestResult = await client.query(
        `
          SELECT status
          FROM resource_requests
          WHERE id = $1
          FOR UPDATE
        `,
        [allocation.request_id]
      );

      if (
        requestResult.rowCount === 0 ||
        requestResult.rows[0].status !== "APPROVED"
      ) {
        throw new ApiError(
          400,
          "The associated request must still be approved."
        );
      }
    }

    const itemsResult = await client.query(
      `
        SELECT resource_id, quantity
        FROM relief_allocation_items
        WHERE allocation_id = $1
        ORDER BY resource_id
      `,
      [allocationId]
    );

    if (itemsResult.rowCount === 0) {
      throw new ApiError(
        400,
        "Add at least one resource before reserving."
      );
    }

    // Lock all involved resource rows in a consistent order.
    // Concurrent reservations must wait for these locks.
    const resourceIds = itemsResult.rows.map(
      (item) => item.resource_id
    );

    const lockedResources = await client.query(
      `
        SELECT id
        FROM relief_resources
        WHERE id = ANY($1::uuid[])
        ORDER BY id
        FOR UPDATE
      `,
      [resourceIds]
    );

    if (lockedResources.rowCount !== resourceIds.length) {
      throw new ApiError(
        400,
        "One or more allocated resources no longer exist."
      );
    }

    for (const item of itemsResult.rows) {
      const resourceResult = await client.query(
        `
          SELECT
            r.id,
            r.quantity,
            r.status,
            r.expiry_date,
            r.available_from,
            r.available_until,
            (
              r.status = 'AVAILABLE'
              AND (r.expiry_date IS NULL OR r.expiry_date >= NOW())
              AND (r.available_from IS NULL OR r.available_from <= NOW())
              AND (r.available_until IS NULL OR r.available_until >= NOW())
            ) AS eligible,
            COALESCE((
              SELECT SUM(ai.quantity)
              FROM relief_allocation_items ai
              INNER JOIN relief_allocations a
                ON a.id = ai.allocation_id
              WHERE ai.resource_id = r.id
                AND a.status IN ('RESERVED', 'DISPATCHED', 'COMPLETED')
                AND a.id <> $2
            ), 0) AS allocated_quantity
          FROM relief_resources r
          WHERE r.id = $1
        `,
        [item.resource_id, allocationId]
      );

      if (resourceResult.rowCount === 0) {
        throw new ApiError(404, "Resource not found.");
      }

      const resource = resourceResult.rows[0];

      if (!resource.eligible) {
        throw new ApiError(
          400,
          `Resource ${item.resource_id} is no longer available.`
        );
      }

      const available =
        Number(resource.quantity) -
        Number(resource.allocated_quantity);

      if (Number(item.quantity) > available) {
        throw new ApiError(
          400,
          `Insufficient stock for resource ${item.resource_id}. Available: ${Math.max(available, 0)}.`
        );
      }
    }

    const updateResult = await client.query(
      `
        UPDATE relief_allocations
        SET status = 'RESERVED', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [allocationId]
    );

    await client.query("COMMIT");
    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelAllocation(allocationId: string) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT *
        FROM relief_allocations
        WHERE id = $1
        FOR UPDATE
      `,
      [allocationId]
    );

    if (result.rowCount === 0) {
      throw new ApiError(404, "Allocation not found.");
    }

    const allocation = result.rows[0];

    if (!["DRAFT", "RESERVED"].includes(allocation.status)) {
      throw new ApiError(
        400,
        "Only draft or reserved allocations can be cancelled."
      );
    }

    const dispatchResult = await client.query(
      `
        SELECT id
        FROM relief_dispatches
        WHERE allocation_id = $1
          AND status <> 'CANCELLED'
        LIMIT 1
      `,
      [allocationId]
    );

    if (dispatchResult.rowCount && dispatchResult.rowCount > 0) {
      throw new ApiError(
        400,
        "Cancel or resolve the associated dispatch before cancelling this allocation."
      );
    }

    const updateResult = await client.query(
      `
        UPDATE relief_allocations
        SET status = 'CANCELLED', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [allocationId]
    );

    await client.query("COMMIT");
    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}