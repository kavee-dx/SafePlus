import pool from "../config/db";

export async function findUserById(
  id: string
): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    `SELECT id, full_name, email, username, phone_number, nic_number,
            date_of_birth, gender, address, city, district, postal_code,
            role, status
       FROM users
      WHERE id = $1`,
    [id]
  );

  return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
}

// `table` must come from a fixed allow-list, never from the request.
export async function findRoleDetails(
  table: string,
  userId: string
): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    `SELECT * FROM ${table} WHERE user_id = $1`,
    [userId]
  );

  return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
}