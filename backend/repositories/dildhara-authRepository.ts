import pool from "../config/db";

export interface UserAuthRow {
  id: string;
  full_name: string;
  email: string;
  username: string | null;
  password_hash: string;
  role: string;
  status: string;
}

export async function findUserByEmail(
  email: string
): Promise<UserAuthRow | null> {
  const result = await pool.query(
    `SELECT id, full_name, email, username, password_hash, role, status
       FROM users
      WHERE email = $1`,
    [email]
  );

  return (result.rows[0] as UserAuthRow | undefined) ?? null;
}