import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import { ApiError } from "../utils/apiError";
import { findSuperAdminByEmail } from "../repositories/amasha-adminRepository";

const JWT_SECRET = process.env.JWT_SECRET || "safeplus-dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

export interface SuperAdmin {
  id: string;
  fullName: string;
  email: string;
}

export interface AdminSession {
  token: string;
  admin: SuperAdmin;
}

export interface AdminTokenPayload {
  sub: string;
  email: string;
  name: string;
  scope: "SUPER_ADMIN";
}

export function signAdminToken(admin: SuperAdmin): string {
  const payload: AdminTokenPayload = {
    sub: admin.id,
    email: admin.email,
    name: admin.fullName,
    scope: "SUPER_ADMIN",
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;

    if (decoded?.scope !== "SUPER_ADMIN") {
      throw new ApiError(401, "Invalid admin token.");
    }

    return decoded;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "Session expired or invalid. Please sign in again.");
  }
}

export async function loginSuperAdmin(
  email: string,
  password: string
): Promise<AdminSession> {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !password) {
    throw new ApiError(400, "Email and password are required.");
  }

  const record = await findSuperAdminByEmail(normalizedEmail);

  if (!record) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(password, record.password_hash);

  if (!passwordMatches) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const admin: SuperAdmin = {
    id: record.id,
    fullName: record.full_name,
    email: record.email,
  };

  return { token: signAdminToken(admin), admin };
}
