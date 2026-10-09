import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/apiError";
import type { UserRole } from "../models/registration";

const VERIFIER_ROLES: UserRole[] = ["DMC_OFFICER", "DISTRICT_OFFICER"];
const OFFICER_ROLES: UserRole[] = ["DMC_OFFICER"];

function guard(
  req: Request,
  allowed: UserRole[],
  message: string
): void {
  if (!req.user) {
    throw new ApiError(401, "Authentication required.");
  }

  if (!allowed.includes(req.user.role as UserRole)) {
    throw new ApiError(403, message);
  }
}

/** Can confirm or reject a citizen's ground report. */
export function requireVerifier(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  guard(req, VERIFIER_ROLES, "Only DMC or district officers can verify reports.");
  next();
}

/** Can raise a disaster warning and hold a clearance PIN. */
export function requireDmcOfficer(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  guard(req, OFFICER_ROLES, "Only DMC officers can issue warnings.");
  next();
}
