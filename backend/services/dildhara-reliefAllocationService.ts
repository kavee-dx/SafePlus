
import { ApiError } from "../utils/apiError";

import {
  cancelAllocation,
  createDraftAllocation,
  getAllocationById,
  listAllocations,
  listAvailableResources,
  reserveAllocation,
  type CreateAllocationInput,
} from "../repositories/dildhara-reliefAllocationRepository";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ApiError(400, "Optional text fields must be strings.");
  }

  return value.trim() || null;
}

function validateUuid(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ApiError(400, `${fieldName} must be a valid UUID.`);
  }

  return value;
}

export async function getAvailableResources() {
  return listAvailableResources();
}

export async function getAllAllocations() {
  return listAllocations();
}

export async function getAllocation(allocationId: string) {
  validateUuid(allocationId, "Allocation ID");

  const allocation = await getAllocationById(allocationId);

  if (!allocation) {
    throw new ApiError(404, "Allocation not found.");
  }

  return allocation;
}

export async function createAllocation(
  coordinatorUserId: string,
  payload: Record<string, unknown>
) {
  const allocationType = cleanText(
    payload.allocationType
  ).toUpperCase();

  if (allocationType !== "REQUEST" && allocationType !== "AREA") {
    throw new ApiError(
      400,
      "Allocation type must be REQUEST or AREA."
    );
  }

  const destinationLocation = cleanText(
    payload.destinationLocation
  );

  const destinationDistrict = cleanText(
    payload.destinationDistrict
  );

  if (!destinationLocation || !destinationDistrict) {
    throw new ApiError(
      400,
      "Destination location and district are required."
    );
  }

  const requestId =
    allocationType === "REQUEST"
      ? validateUuid(payload.requestId, "Request ID")
      : undefined;

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new ApiError(
      400,
      "Add at least one resource to the allocation."
    );
  }

  const items = payload.items.map((rawItem, index) => {
    if (
      typeof rawItem !== "object" ||
      rawItem === null ||
      Array.isArray(rawItem)
    ) {
      throw new ApiError(
        400,
        `Resource item ${index + 1} is invalid.`
      );
    }

    const item = rawItem as Record<string, unknown>;

    const resourceId = validateUuid(
      item.resourceId,
      `Resource ID for item ${index + 1}`
    );

    const quantity = item.quantity;

    if (
      typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new ApiError(
        400,
        `Quantity for item ${index + 1} must be a positive number.`
      );
    }

    return { resourceId, quantity };
  });

  const uniqueResourceIds = new Set(
    items.map((item) => item.resourceId)
  );

  if (uniqueResourceIds.size !== items.length) {
    throw new ApiError(
      400,
      "Each resource can appear only once in an allocation."
    );
  }

  const input: CreateAllocationInput = {
    allocationType,
    requestId,
    destinationName: optionalText(payload.destinationName),
    destinationLocation,
    destinationDistrict,
    notes: optionalText(payload.notes),
    items,
  };

  return createDraftAllocation(coordinatorUserId, input);
}

export async function reserveDraftAllocation(
  allocationId: string
) {
  validateUuid(allocationId, "Allocation ID");
  return reserveAllocation(allocationId);
}

export async function cancelDraftOrReservation(
  allocationId: string
) {
  validateUuid(allocationId, "Allocation ID");
  return cancelAllocation(allocationId);
}