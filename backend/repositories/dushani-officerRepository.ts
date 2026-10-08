import pool from "../config/db";

export interface OfficerPinRecord {
  userId: string;
  pinHash: string | null;
  pinUpdatedAt: Date | null;
}

/**
 * The PIN lives on the officer profile row but every request only knows the
 * authenticated subject (users.id), so all lookups join through user_id.
 */
export async function findOfficerByUserId(
  userId: string
): Promise<OfficerPinRecord | null> {
  const result = await pool.query(
    `SELECT o.user_id, o.clearance_pin_hash, o.pin_updated_at
       FROM dmc_officers o
      WHERE o.user_id = $1
      LIMIT 1`,
    [userId]
  );

  const row = result.rows[0] as
    | { user_id: string; clearance_pin_hash: string | null; pin_updated_at: Date | null }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    pinHash: row.clearance_pin_hash,
    pinUpdatedAt: row.pin_updated_at,
  };
}

export async function updateOfficerPinHash(
  userId: string,
  pinHash: string
): Promise<Date | null> {
  const result = await pool.query(
    `UPDATE dmc_officers
        SET clearance_pin_hash = $2,
            pin_updated_at = NOW(),
            updated_at = NOW()
      WHERE user_id = $1
      RETURNING pin_updated_at`,
    [userId, pinHash]
  );

  return (result.rows[0]?.pin_updated_at as Date | undefined) ?? null;
}
