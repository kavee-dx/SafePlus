import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/apiError";

interface PgError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
}

const UNIQUE_FIELD_LABELS: Record<string, string> = {
  "users_email_key": "email",
  "users_username_key": "username",
  "users_nic_number_key": "nicNumber",
  email: "email",
  username: "username",
  nic_number: "nicNumber",
  "relief_agencies_registration_number_key": "registrationNumber",
  registration_number: "registrationNumber",
  "rescue_organizations_registration_number_key": "registrationNumber",
  "dmc_officers_officer_id_key": "officerId",
  officer_id: "officerId",
};

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  email: "email address",
  username: "username",
  nicNumber: "NIC number",
  registrationNumber: "registration number",
  officerId: "officer ID",
};

function uniqueField(pgError: PgError): string | undefined {
  const constraint = pgError.constraint;
  const column = pgError.detail?.match(/Key \(([^)]+)\)=/)?.[1];

  return (
    (constraint ? UNIQUE_FIELD_LABELS[constraint] : undefined) ??
    (column ? UNIQUE_FIELD_LABELS[column] : undefined)
  );
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
  });
}

export function errorHandler(
  error: unknown,
  req: Request,
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
    const isDeliveryRegistration =
      /(?:^|\/)registrations\/delivery-volunteer(?:-team)?(?:[/?]|$)/.test(
        req.originalUrl
      );

    if (isDeliveryRegistration) {
      const field = uniqueField(pgError);

      if (field) {
        res.status(409).json({
          message: `That ${FIELD_DISPLAY_NAMES[field] ?? "value"} is already registered. Please use a different one.`,
          errors: { [field]: "Already in use by another account." },
        });
        return;
      }
    } else {
      const constraint =
        String(pgError.detail ?? "").match(/:\s(\w+)/)?.[1] ?? "";
      const field = UNIQUE_FIELD_LABELS[constraint];

      if (field) {
        res.status(409).json({
          message: "That value is already registered.",
          errors: { [field]: "Already in use by another account." },
        });
        return;
      }
    }

    res.status(409).json({ message: "Record already exists." });
    return;
  }

  console.error("Unhandled API error:", error);

  res.status(500).json({ message: "Something went wrong. Please try again." });
}
