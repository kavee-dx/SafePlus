import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/apiError";
import type { UserRole } from "../models/registration";

const BOARD_ROLES: UserRole[] = ["DISTRICT_OFFICER", "DMC_OFFICER"];

/**
 * Guards the district rescue board. A District Officer reads it to find teams
 * for their own district (and, on request, mutual-aid teams from elsewhere);
 * a DMC duty officer gets the same screen with every district already open.
 */
export function requireDistrictBoard(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    throw new ApiError(401, "Authentication required.");
  }

  if (!BOARD_ROLES.includes(req.user.role as UserRole)) {
    throw new ApiError(
      403,
      "Only district and DMC officers can open the rescue team board."
    );
  }

  next();
}
