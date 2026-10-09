import { ApiError } from "../utils/apiError";
import {
  addTrackingUpdate,
  confirmDelivery,
  createAssignment,
  createDispatch,
  getDispatch,
  listDispatchAssignmentOptions,
  listDispatches,
  respondToDispatch,
  updateDispatchStatus,
} from "../repositories/dildhara-reliefDispatchRepository";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ApiError(400, `${field} must be a valid UUID.`);
  }

  return value;
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireUuid(value, field);
}

function optionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value !== "string") {
    throw new ApiError(400, `${field} must be text.`);
  }

  return value.trim() || null;
}

export async function createDispatchForAllocation(
  allocationId: unknown,
  userId: unknown,
  body: Record<string, unknown>
) {
  const id = requireUuid(allocationId, "allocationId");
  const actorId = requireUuid(userId, "userId");

  let plannedDeparture: string | null = null;

  if (body.plannedDeparture) {
    if (typeof body.plannedDeparture !== "string") {
      throw new ApiError(400, "plannedDeparture must be a date-time string.");
    }

    if (Number.isNaN(Date.parse(body.plannedDeparture))) {
      throw new ApiError(400, "plannedDeparture must be a valid date-time.");
    }

    plannedDeparture = new Date(body.plannedDeparture).toISOString();
  }

  return createDispatch(
    id,
    actorId,
    plannedDeparture,
    optionalText(body.notes, "notes")
  );
}

export async function getDispatchDetails(dispatchId: unknown) {
  return getDispatch(requireUuid(dispatchId, "dispatchId"));
}

export async function getDispatches() {
  return listDispatches();
}

export async function getDispatchAssignmentOptions() {
  return listDispatchAssignmentOptions();
}

export async function recordAgencyResponse(
  dispatchId: unknown,
  userId: unknown,
  body: Record<string, unknown>
) {
  const response = body.response;

  if (response !== "ACCEPTED" && response !== "REJECTED") {
    throw new ApiError(400, "response must be ACCEPTED or REJECTED.");
  }

  return respondToDispatch(
    requireUuid(dispatchId, "dispatchId"),
    requireUuid(userId, "userId"),
    response,
    optionalText(body.notes, "notes")
  );
}

export async function assignDispatchTrip(
  dispatchId: unknown,
  body: Record<string, unknown>
) {
  const id = requireUuid(dispatchId, "dispatchId");

  if (!Array.isArray(body.items)) {
    throw new ApiError(400, "items must be an array.");
  }

  const tripNumber = Number(body.tripNumber);

  if (!Number.isInteger(tripNumber) || tripNumber < 1) {
    throw new ApiError(400, "tripNumber must be a positive integer.");
  }

  const items = body.items.map((item: unknown) => {
    if (!item || typeof item !== "object") {
      throw new ApiError(400, "Each dispatched item must be an object.");
    }

    const value = item as Record<string, unknown>;

    return {
      allocationItemId: requireUuid(
        value.allocationItemId,
        "allocationItemId"
      ),
      quantityDispatched: Number(value.quantityDispatched),
    };
  });

  if (
    items.some(
      (item) =>
        !Number.isFinite(item.quantityDispatched) ||
        item.quantityDispatched <= 0
    )
  ) {
    throw new ApiError(400, "Dispatched quantities must be positive numbers.");
  }

  if (new Set(items.map((item) => item.allocationItemId)).size !== items.length) {
    throw new ApiError(400, "Each allocation item can be assigned only once per trip.");
  }

  return createAssignment(id, {
    vehicleId: optionalUuid(body.vehicleId, "vehicleId"),
    driverUserId: optionalUuid(body.driverUserId, "driverUserId"),
    volunteerProfileId: optionalUuid(
      body.volunteerProfileId,
      "volunteerProfileId"
    ),
    teamProfileId: optionalUuid(body.teamProfileId, "teamProfileId"),
    tripNumber,
    notes: optionalText(body.notes, "notes"),
    items,
  });
}

export async function markDispatchDeparted(
  dispatchId: unknown,
  userId: unknown
) {
  return updateDispatchStatus(
    requireUuid(dispatchId, "dispatchId"),
    requireUuid(userId, "userId"),
    "IN_TRANSIT"
  );
}

export async function recordTracking(
  dispatchId: unknown,
  userId: unknown,
  body: Record<string, unknown>
) {
  const latitude =
    body.latitude === undefined || body.latitude === null
      ? null
      : Number(body.latitude);

  const longitude =
    body.longitude === undefined || body.longitude === null
      ? null
      : Number(body.longitude);

  if (latitude !== null && !Number.isFinite(latitude)) {
    throw new ApiError(400, "latitude must be a number.");
  }

  if (longitude !== null && !Number.isFinite(longitude)) {
    throw new ApiError(400, "longitude must be a number.");
  }

  return addTrackingUpdate(
    requireUuid(dispatchId, "dispatchId"),
    requireUuid(userId, "userId"),
    {
      locationLabel: optionalText(body.locationLabel, "locationLabel"),
      latitude,
      longitude,
      notes: optionalText(body.notes, "notes"),
    }
  );
}

export async function recordDeliveryConfirmation(
  dispatchId: unknown,
  userId: unknown,
  body: Record<string, unknown>
) {
  const condition = body.condition;

  if (
    condition !== "ACCEPTED" &&
    condition !== "PARTIAL" &&
    condition !== "DAMAGED" &&
    condition !== "REJECTED"
  ) {
    throw new ApiError(
      400,
      "condition must be ACCEPTED, PARTIAL, DAMAGED, or REJECTED."
    );
  }

  if (typeof body.receiverName !== "string" || !body.receiverName.trim()) {
    throw new ApiError(400, "receiverName is required.");
  }

  if (!Array.isArray(body.items)) {
    throw new ApiError(400, "items must be an array.");
  }

  const items = body.items.map((item: unknown) => {
    if (!item || typeof item !== "object") {
      throw new ApiError(400, "Each delivery item must be an object.");
    }

    const value = item as Record<string, unknown>;

    return {
      dispatchItemId: requireUuid(value.dispatchItemId, "dispatchItemId"),
      quantityReceived: Number(value.quantityReceived),
      quantityDamaged: Number(value.quantityDamaged),
      quantityMissing: Number(value.quantityMissing),
    };
  });

  if (
    items.some((item) =>
      [
        item.quantityReceived,
        item.quantityDamaged,
        item.quantityMissing,
      ].some((quantity) => !Number.isFinite(quantity) || quantity < 0)
    )
  ) {
    throw new ApiError(
      400,
      "Received, damaged, and missing quantities must be zero or greater."
    );
  }

  if (new Set(items.map((item) => item.dispatchItemId)).size !== items.length) {
    throw new ApiError(400, "Each dispatched item must be confirmed only once.");
  }

  return confirmDelivery(
    requireUuid(dispatchId, "dispatchId"),
    requireUuid(userId, "userId"),
    {
      receiverName: body.receiverName,
      receiverPhone: optionalText(body.receiverPhone, "receiverPhone"),
      condition,
      notes: optionalText(body.notes, "notes"),
      items,
    }
  );
}