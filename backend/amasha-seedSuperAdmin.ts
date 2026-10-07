import { randomUUID } from "node:crypto";

import bcrypt from "bcrypt";
import dotenv from "dotenv";

import pool from "./config/db";

dotenv.config();

const BCRYPT_ROUNDS = 12;

async function seedSuperAdmin() {
  const email = (process.env.SUPER_ADMIN_EMAIL || "superadmin@safeplus.lk")
    .trim()
    .toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@123";
  const fullName = process.env.SUPER_ADMIN_NAME || "SafePlus Super Admin";

  const client = await pool.connect();

  try {
    const existing = await client.query(
      "SELECT id FROM super_admins WHERE email = $1",
      [email]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`Super admin already exists for ${email}. Nothing to do.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await client.query(
      `INSERT INTO super_admins (id, full_name, email, password_hash)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), fullName, email, passwordHash]
    );

    console.log("Super admin created successfully.");
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log(
      "  Change SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD in backend/.env and re-run to create a different admin."
    );
  } catch (error) {
    console.error("Failed to seed super admin:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedSuperAdmin();
