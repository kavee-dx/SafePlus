import type { Request, Response } from "express";

import {
  approveRegistration,
  getRegistration,
  getStats,
  listRegistrations,
  rejectRegistration,
} from "../services/amasha-adminService";
import { loginSuperAdmin } from "../services/amasha-adminAuthService";
import { findSuperAdminById } from "../repositories/amasha-adminRepository";
import { ApiError } from "../utils/apiError";
import type { AccountStatus, UserRole } from "../models/registration";

function adminId(req: Request): string {
  const id = req.admin?.sub;
  if (!id) throw new ApiError(401, "Authentication required.");
  return id;
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  const session = await loginSuperAdmin(String(email ?? ""), String(password ?? ""));

  res.json({
    message: "Signed in successfully.",
    token: session.token,
    admin: session.admin,
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  const id = adminId(req);
  const admin = await findSuperAdminById(id);

  if (!admin) throw new ApiError(401, "Admin account no longer exists.");

  res.json({ admin });
}

export async function list(req: Request, res: Response): Promise<void> {
  const status = (req.query.status as AccountStatus | "ALL") || "ALL";
  const role = (req.query.role as UserRole | "ALL") || "ALL";

  const registrations = await listRegistrations({ status, role });

  res.json({ registrations });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const registration = await getRegistration(String(req.params.id));
  res.json({ registration });
}

export async function stats(_req: Request, res: Response): Promise<void> {
  res.json({ stats: await getStats() });
}

export async function approve(req: Request, res: Response): Promise<void> {
  const registration = await approveRegistration(
    String(req.params.id),
    adminId(req)
  );

  res.json({
    message: `Registration for ${registration.email} has been approved.`,
    registration,
  });
}

export async function reject(req: Request, res: Response): Promise<void> {
  const { reason } = req.body as { reason?: string };

  const registration = await rejectRegistration(
    String(req.params.id),
    String(reason ?? ""),
    adminId(req)
  );

  res.json({
    message: `Registration for ${registration.email} has been rejected.`,
    registration,
  });
}
