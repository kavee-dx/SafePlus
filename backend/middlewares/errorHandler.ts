import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/apiError";

interface PgError extends Error {
  code?: string;
  detail?: string;
}

const UNIQUE_FIELD_LABELS: Record<string, string> = {
  "users_email_key": "email",
  "users_username_key": "username",
  "users_nic_number_key": "nicNumber",
  "relief_agencies_registration_number_key": "registrationNumber",
  "dmc_officers_officer_id_key": "officerId",
};

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      message: error.message,
      ...(error.fieldErrors ? { errors: error.fieldErrors } : {}),
    });
    return;
  }

  const pgError = error as PgError;

  if (pgError?.code === "23505") {
    const constraint = String(pgError.detail ?? "").match(/:\s(\w+)/)?.[1] ?? "";
    const field = UNIQUE_FIELD_LABELS[constraint];

    if (field) {
      res.status(409).json({
        message: "That value is already registered.",
        errors: { [field]: "Already in use by another account." },
      });
      return;
    }

    res.status(409).json({ message: "Record already exists." });
    return;
  }

  console.error("Unhandled API error:", error);

  res.status(500).json({ message: "Something went wrong. Please try again." });
}
