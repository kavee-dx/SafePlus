import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/apiError";
import type { UserRole } from "../models/registration";

/**
 * Guards the shelter-side workspace. A Shelter Manager is created by a District
 * Officer and signs in to the portal to run the shelters assigned to them; which
 * shelters those are is resolved from their profile in the service, never here.
 */
export function requireShelterManager(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    throw new ApiError(401, "Authentication required.");
  }

  if ((req.user.role as UserRole) !== "SHELTER_MANAGER") {
    throw new ApiError(
      403,
      "Only a shelter manager can open this workspace."
    );
  }

  next();
}
