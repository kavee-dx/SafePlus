import { randomUUID } from "crypto";
import pool from "../config/db";
import type {
  CreateResourceRequestInput,
  ResourceRequest,
  ResourceRequestStatus,
} from "../models/dildhara-resourceRequest";

function mapRow(row: any): ResourceRequest {
  return {
    id: row.id,
    requesterUserId: row.requester_user_id,

    resourceType: row.resource_type,
    resourceName: row.resource_name,
    description: row.description,

    quantity: Number(row.quantity),
    unit: row.unit,

    urgency: row.urgency,

    requiredDate: row.required_date
      ? String(row.required_date).slice(0, 10)
      : null,

    location: row.location,
    district: row.district,

    status: row.status,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createResourceRequest(
  requesterUserId: string,
  input: CreateResourceRequestInput
): Promise<ResourceRequest> {
  const id = randomUUID();

  const result = await pool.query(
    `
      INSERT INTO resource_requests (
        id,
        requester_user_id,
        resource_type,
        resource_name,
        description,
        quantity,
        unit,
        urgency,
        required_date,
        location,
        district
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11
      )
      RETURNING *
    `,
    [
      id,
      requesterUserId,
      input.resourceType,
      input.resourceName,
      input.description || null,
      input.quantity,
      input.unit,
      input.urgency,
      input.requiredDate || null,
      input.location,
      input.district,
    ]
  );

  return mapRow(result.rows[0]);
}

export async function findRequestsByUser(
  requesterUserId: string
): Promise<ResourceRequest[]> {
  const result = await pool.query(
    `
      SELECT *
      FROM resource_requests
      WHERE requester_user_id = $1
      ORDER BY created_at DESC
    `,
    [requesterUserId]
  );

  return result.rows.map(mapRow);
}

export async function findRequestById(
  id: string
): Promise<ResourceRequest | null> {
  const result = await pool.query(
    `
      SELECT *
      FROM resource_requests
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRow(result.rows[0]);
}

export async function findAllResourceRequests(
  status?: ResourceRequestStatus,
  district?: string
): Promise<ResourceRequest[]> {
  const values: string[] = [];
  const conditions: string[] = [];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  if (district) {
    values.push(district);
    conditions.push(`LOWER(district) = LOWER($${values.length})`);
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const result = await pool.query(
    `
      SELECT *
      FROM resource_requests
      ${whereClause}
      ORDER BY
        CASE urgency
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
          ELSE 5
        END,
        created_at DESC
    `,
    values
  );

  return result.rows.map(mapRow);
}

export async function updateResourceRequestStatus(
  id: string,
  status: ResourceRequestStatus
): Promise<ResourceRequest | null> {
  const result = await pool.query(
    `
      UPDATE resource_requests
      SET
        status = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
    [status, id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRow(result.rows[0]);
}