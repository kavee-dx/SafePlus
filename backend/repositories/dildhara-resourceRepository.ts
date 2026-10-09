import pool from "../config/db";

export interface ResourceRow {
  id: string;
  provider_user_id: string;
  resource_type: string;
  resource_name: string;
  description: string | null;
  quantity: string;
  unit: string;
  location: string | null;
  district: string;
  available_from: string | null;
  available_until: string | null;
  expiry_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export type ResourceInventoryRow = ResourceRow & {
  provider_name: string;
  provider_role: string;
  contributor_type: "INDIVIDUAL" | "ORGANIZATION";
  availability_condition:
    | "AVAILABLE"
    | "UNAVAILABLE"
    | "EXPIRED"
    | "CANCELLED"
    | "NOT_YET_AVAILABLE"
    | "AVAILABILITY_ENDED";
  expiry_condition:
    | "NO_EXPIRY"
    | "EXPIRED"
    | "EXPIRING_SOON"
    | "NEAR_EXPIRY"
    | "VALID";
};

export async function findAllResourcesForInventory():
  Promise<ResourceInventoryRow[]> {
  const result = await pool.query<ResourceInventoryRow>(
    `
      SELECT
        r.*,
        u.full_name AS provider_name,
        u.role AS provider_role,

        CASE
          WHEN u.role = 'RELIEF_AGENCY'
            THEN 'ORGANIZATION'
          ELSE 'INDIVIDUAL'
        END AS contributor_type,

        CASE
          WHEN r.status = 'CANCELLED' THEN 'CANCELLED'
          WHEN r.status = 'EXPIRED' THEN 'EXPIRED'
          WHEN r.status <> 'AVAILABLE' THEN 'UNAVAILABLE'
          WHEN r.expiry_date IS NOT NULL
            AND r.expiry_date < NOW() THEN 'EXPIRED'
          WHEN r.available_from IS NOT NULL
            AND r.available_from > NOW() THEN 'NOT_YET_AVAILABLE'
          WHEN r.available_until IS NOT NULL
            AND r.available_until < NOW() THEN 'AVAILABILITY_ENDED'
          ELSE 'AVAILABLE'
        END AS availability_condition,

        CASE
          WHEN r.expiry_date IS NULL THEN 'NO_EXPIRY'
          WHEN r.expiry_date < NOW() THEN 'EXPIRED'
          WHEN r.expiry_date <= NOW() + INTERVAL '3 days'
            THEN 'EXPIRING_SOON'
          WHEN r.expiry_date <= NOW() + INTERVAL '7 days'
            THEN 'NEAR_EXPIRY'
          ELSE 'VALID'
        END AS expiry_condition

      FROM relief_resources r
      INNER JOIN users u
        ON u.id = r.provider_user_id

      WHERE u.role IN ('RELIEF_AGENCY', 'FOOD_DONOR')

      ORDER BY
        CASE
          WHEN r.status = 'AVAILABLE'
            AND (r.expiry_date IS NULL OR r.expiry_date >= NOW())
            AND (r.available_from IS NULL OR r.available_from <= NOW())
            AND (r.available_until IS NULL OR r.available_until >= NOW())
            THEN 0
          ELSE 1
        END,
        r.expiry_date ASC NULLS LAST,
        r.created_at DESC
    `
  );

  return result.rows;
}

export interface CreateResourceData {
  id: string;
  providerUserId: string;
  resourceType: string;
  resourceName: string;
  description: string | null;
  quantity: number;
  unit: string;
  location: string | null;
  district: string;
  availableFrom: string | null;
  availableUntil: string | null;
  expiryDate: string | null;
}

export interface UpdateResourceData {
  resourceType?: string;
  resourceName?: string;
  description?: string | null;
  quantity?: number;
  unit?: string;
  location?: string | null;
  district?: string;
  availableFrom?: string | null;
  availableUntil?: string | null;
  expiryDate?: string | null;
  status?: string;
}

export async function createResource(
  data: CreateResourceData
): Promise<ResourceRow> {
  const result = await pool.query<ResourceRow>(
    `
      INSERT INTO relief_resources (
        id,
        provider_user_id,
        resource_type,
        resource_name,
        description,
        quantity,
        unit,
        location,
        district,
        available_from,
        available_until,
        expiry_date,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, 'AVAILABLE'
      )
      RETURNING *
    `,
    [
      data.id,
      data.providerUserId,
      data.resourceType,
      data.resourceName,
      data.description,
      data.quantity,
      data.unit,
      data.location,
      data.district,
      data.availableFrom,
      data.availableUntil,
      data.expiryDate,
    ]
  );

  return result.rows[0];
}

export async function findResourcesByProvider(
  providerUserId: string
): Promise<ResourceRow[]> {
  const result = await pool.query<ResourceRow>(
    `
      SELECT *
      FROM relief_resources
      WHERE provider_user_id = $1
      ORDER BY created_at DESC
    `,
    [providerUserId]
  );

  return result.rows;
}

export async function findResourceById(
  resourceId: string,
  providerUserId: string
): Promise<ResourceRow | null> {
  const result = await pool.query<ResourceRow>(
    `
      SELECT *
      FROM relief_resources
      WHERE id = $1
        AND provider_user_id = $2
      LIMIT 1
    `,
    [resourceId, providerUserId]
  );

  return result.rows[0] ?? null;
}

export async function updateResource(
  resourceId: string,
  providerUserId: string,
  data: UpdateResourceData
): Promise<ResourceRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  const addField = (column: string, value: unknown) => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (data.resourceType !== undefined) {
    addField("resource_type", data.resourceType);
  }

  if (data.resourceName !== undefined) {
    addField("resource_name", data.resourceName);
  }

  if (data.description !== undefined) {
    addField("description", data.description);
  }

  if (data.quantity !== undefined) {
    addField("quantity", data.quantity);
  }

  if (data.unit !== undefined) {
    addField("unit", data.unit);
  }

  if (data.location !== undefined) {
    addField("location", data.location);
  }

  if (data.district !== undefined) {
    addField("district", data.district);
  }

  if (data.availableFrom !== undefined) {
    addField("available_from", data.availableFrom);
  }

  if (data.availableUntil !== undefined) {
    addField("available_until", data.availableUntil);
  }

  if (data.expiryDate !== undefined) {
    addField("expiry_date", data.expiryDate);
  }

  if (data.status !== undefined) {
    addField("status", data.status);
  }

  if (fields.length === 0) {
    return findResourceById(resourceId, providerUserId);
  }

  fields.push("updated_at = NOW()");

  values.push(resourceId);
  const resourceIdParam = `$${values.length}`;

  values.push(providerUserId);
  const providerParam = `$${values.length}`;

  const result = await pool.query<ResourceRow>(
    `
      UPDATE relief_resources
      SET ${fields.join(", ")}
      WHERE id = ${resourceIdParam}
        AND provider_user_id = ${providerParam}
      RETURNING *
    `,
    values
  );

  return result.rows[0] ?? null;
}

export async function deleteResource(
  resourceId: string,
  providerUserId: string
): Promise<boolean> {
  const result = await pool.query(
    `
      DELETE FROM relief_resources
      WHERE id = $1
        AND provider_user_id = $2
    `,
    [resourceId, providerUserId]
  );

  return result.rowCount === 1;
}