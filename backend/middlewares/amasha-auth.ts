import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/apiError";
import {
  verifyAdminToken,
  type AdminTokenPayload,
} from "../services/amasha-adminAuthService";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}

export function requireSuperAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, "Authentication required.");
  }

  req.admin = verifyAdminToken(token);
  next();
}
