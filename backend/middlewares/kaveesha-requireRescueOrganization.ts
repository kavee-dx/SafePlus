import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/apiError";
import type { UserRole } from "../models/registration";

const RESCUE_ORG_ADMIN_ROLE: UserRole = "RESCUE_ORGANIZATION_ADMIN";

/**
 * Guards the rescue-organization workspace. The account belongs to an
 * authorized representative of the organization, not to a DMC officer.
 */
export function requireRescueOrganizationAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    throw new ApiError(401, "Authentication required.");
  }

  if (req.user.role !== RESCUE_ORG_ADMIN_ROLE) {
    throw new ApiError(
      403,
      "Only rescue organization administrators can open this workspace."
    );
  }

  next();
}
