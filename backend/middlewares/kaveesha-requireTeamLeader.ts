import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/apiError";
import type { UserRole } from "../models/registration";

const TEAM_LEADER_ROLES: UserRole[] = [
  "ORGANIZATION_TEAM_LEADER",
  "INDEPENDENT_TEAM_LEADER",
];

/**
 * Guards the team leader workspace. Both team leader roles land here; who
 * reviews the team (Super Admin or Organization Admin) is stored on the row.
 */
export function requireTeamLeader(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    throw new ApiError(401, "Authentication required.");
  }

  if (!TEAM_LEADER_ROLES.includes(req.user.role as UserRole)) {
    throw new ApiError(
      403,
      "Only rescue team leaders can open this workspace."
    );
  }

  next();
}
