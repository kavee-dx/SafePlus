import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/apiError";
import {
  verifyUserToken,
  type UserTokenPayload,
} from "../services/dildhara-authService";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
    }
  }
}

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, "Authentication required.");
  }

  req.user = verifyUserToken(token);
  next();
}