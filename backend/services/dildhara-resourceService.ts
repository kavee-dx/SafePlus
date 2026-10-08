import crypto from "crypto";

import { ApiError } from "../utils/apiError";

import {
  createResource,
  deleteResource,
  findResourceById,
  findResourcesByProvider,
  updateResource,
  type UpdateResourceData,
} from "../repositories/dildhara-resourceRepository";

const ALLOWED_PROVIDER_ROLES = [
  "RELIEF_AGENCY",
  "FOOD_DONOR",
];

const ALLOWED_STATUSES = [
  "AVAILABLE",
  "UNAVAILABLE",
  "EXPIRED",
  "CANCELLED",
];

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown): string | null {
  const valueAsString = cleanString(value);
  return valueAsString || null;
}

function parsePositiveNumber(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new ApiError(400, "Quantity must be greater than zero.");
  }

  return number;
}

function parseOptionalDate(
  value: unknown,
  fieldName: string
): string | null {
  const valueAsString = cleanString(value);

  if (!valueAsString) {
    return null;
  }

  const date = new Date(valueAsString);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${fieldName} is not a valid date.`);
  }

  return date.toISOString();
}

function validateProviderRole(role: string): void {
  if (!ALLOWED_PROVIDER_ROLES.includes(role)) {
    throw new ApiError(
      403,
      "Your account is not allowed to provide relief resources."
    );
  }
}

export async function provideResource(
  providerUserId: string,
  providerRole: string,
  payload: Record<string, unknown>
) {
  validateProviderRole(providerRole);

  const resourceType = cleanString(payload.resourceType);
  const resourceName = cleanString(payload.resourceName);
  const description = nullableString(payload.description);
  const unit = cleanString(payload.unit);
  const location = nullableString(payload.location);
  const district = cleanString(payload.district);

  if (!resourceType) {
    throw new ApiError(400, "Resource type is required.");
  }

  if (!resourceName) {
    throw new ApiError(400, "Resource name is required.");
  }

  if (!unit) {
    throw new ApiError(400, "Unit is required.");
  }

  if (!district) {
    throw new ApiError(400, "District is required.");
  }

  const quantity = parsePositiveNumber(payload.quantity);

  const availableFrom = parseOptionalDate(
    payload.availableFrom,
    "Available from"
  );

  const availableUntil = parseOptionalDate(
    payload.availableUntil,
    "Available until"
  );

  const expiryDate = parseOptionalDate(
    payload.expiryDate,
    "Expiry date"
  );

  if (
    availableFrom &&
    availableUntil &&
    new Date(availableUntil) < new Date(availableFrom)
  ) {
    const today = new Date();
today.setHours(0, 0, 0, 0);

if (
  availableFrom &&
  new Date(availableFrom) < today
) {
  throw new ApiError(
    400,
    "Available from cannot be a past date."
  );
}

if (
  availableUntil &&
  new Date(availableUntil) < today
) {
  throw new ApiError(
    400,
    "Available until cannot be a past date."
  );
}

if (
  expiryDate &&
  new Date(expiryDate) < today
) {
  throw new ApiError(
    400,
    "Expiry date cannot be a past date."
  );
}
    throw new ApiError(
      400,
      "Available until cannot be earlier than available from."
    );
  }

  if (
    availableFrom &&
    expiryDate &&
    new Date(expiryDate) < new Date(availableFrom)
  ) {
    throw new ApiError(
      400,
      "Expiry date cannot be earlier than available from."
    );
  }

  return createResource({
    id: crypto.randomUUID(),
    providerUserId,
    resourceType,
    resourceName,
    description,
    quantity,
    unit,
    location,
    district,
    availableFrom,
    availableUntil,
    expiryDate,
  });
}

export async function getMyResources(providerUserId: string) {
  return findResourcesByProvider(providerUserId);
}

export async function getMyResource(
  providerUserId: string,
  resourceId: string
) {
  const resource = await findResourceById(resourceId, providerUserId);

  if (!resource) {
    throw new ApiError(404, "Resource not found.");
  }

  return resource;
}

export async function editMyResource(
  providerUserId: string,
  providerRole: string,
  resourceId: string,
  payload: Record<string, unknown>
) {
  validateProviderRole(providerRole);

  const existing = await findResourceById(resourceId, providerUserId);

  if (!existing) {
    throw new ApiError(404, "Resource not found.");
  }

  if (
    existing.status === "CANCELLED" ||
    existing.status === "EXPIRED"
  ) {
    throw new ApiError(
      400,
      "This resource can no longer be edited."
    );
  }

  const changes: UpdateResourceData = {};

  if (payload.resourceType !== undefined) {
    const value = cleanString(payload.resourceType);

    if (!value) {
      throw new ApiError(400, "Resource type cannot be empty.");
    }

    changes.resourceType = value;
  }

  if (payload.resourceName !== undefined) {
    const value = cleanString(payload.resourceName);

    if (!value) {
      throw new ApiError(400, "Resource name cannot be empty.");
    }

    changes.resourceName = value;
  }

  if (payload.description !== undefined) {
    changes.description = nullableString(payload.description);
  }

  if (payload.quantity !== undefined) {
    changes.quantity = parsePositiveNumber(payload.quantity);
  }

  if (payload.unit !== undefined) {
    const value = cleanString(payload.unit);

    if (!value) {
      throw new ApiError(400, "Unit cannot be empty.");
    }

    changes.unit = value;
  }

  if (payload.location !== undefined) {
    changes.location = nullableString(payload.location);
  }

  if (payload.district !== undefined) {
    const value = cleanString(payload.district);

    if (!value) {
      throw new ApiError(400, "District cannot be empty.");
    }

    changes.district = value;
  }

  if (payload.availableFrom !== undefined) {
    changes.availableFrom = parseOptionalDate(
      payload.availableFrom,
      "Available from"
    );
  }

  if (payload.availableUntil !== undefined) {
    changes.availableUntil = parseOptionalDate(
      payload.availableUntil,
      "Available until"
    );
  }

  if (payload.expiryDate !== undefined) {
    changes.expiryDate = parseOptionalDate(
      payload.expiryDate,
      "Expiry date"
    );
  }

  if (payload.status !== undefined) {
    const status = cleanString(payload.status).toUpperCase();

    if (!ALLOWED_STATUSES.includes(status)) {
      throw new ApiError(400, "Invalid resource status.");
    }

    changes.status = status;
  }

  return updateResource(
    resourceId,
    providerUserId,
    changes
  );
}

export async function removeMyResource(
  providerUserId: string,
  resourceId: string
) {
  const existing = await findResourceById(resourceId, providerUserId);

  if (!existing) {
    throw new ApiError(404, "Resource not found.");
  }

  if (existing.status !== "AVAILABLE") {
    throw new ApiError(
      400,
      "Only available resources can be removed."
    );
  }

  const deleted = await deleteResource(
    resourceId,
    providerUserId
  );

  if (!deleted) {
    throw new ApiError(404, "Resource not found.");
  }
}