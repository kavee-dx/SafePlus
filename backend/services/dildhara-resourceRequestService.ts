import { ApiError } from "../utils/apiError";
import {
  createResourceRequest,
  findAllResourceRequests,
  findRequestById,
  findRequestsByUser,
  updateResourceRequestStatus,
} from "../repositories/dildhara-resourceRequestRepository";
import type {
  CreateResourceRequestInput,
  ResourceRequestStatus,
  ResourceRequestUrgency,
} from "../models/dildhara-resourceRequest";

const VALID_URGENCIES: ResourceRequestUrgency[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

const VALID_STATUSES: ResourceRequestStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "FULFILLED",
  "CANCELLED",
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validateDate(date: string): void {
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, "Required date is invalid.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (parsed < today) {
    throw new ApiError(
      400,
      "Required date cannot be a past date."
    );
  }
}

export async function createRequest(
  requesterUserId: string,
  body: any
) {
  const resourceType = clean(body.resourceType);
  const resourceName = clean(body.resourceName);
  const description = clean(body.description);
  const unit = clean(body.unit);
  const location = clean(body.location);
  const district = clean(body.district);

  if (!resourceType) {
    throw new ApiError(400, "Resource type is required.");
  }

  if (!resourceName) {
    throw new ApiError(400, "Resource name is required.");
  }

  if (!unit) {
    throw new ApiError(400, "Unit is required.");
  }

  if (!location) {
    throw new ApiError(400, "Location is required.");
  }

  if (!district) {
    throw new ApiError(400, "District is required.");
  }

  const quantity = Number(body.quantity);

  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    throw new ApiError(
      400,
      "Quantity must be a positive whole number."
    );
  }

  const urgency = clean(body.urgency) as ResourceRequestUrgency;

  if (!VALID_URGENCIES.includes(urgency)) {
    throw new ApiError(
      400,
      "Urgency must be LOW, MEDIUM, HIGH, or CRITICAL."
    );
  }

  const requiredDate = clean(body.requiredDate);

  if (requiredDate) {
    validateDate(requiredDate);
  }

  const input: CreateResourceRequestInput = {
    resourceType,
    resourceName,
    description,
    quantity,
    unit,
    urgency,
    requiredDate: requiredDate || undefined,
    location,
    district,
  };

  return createResourceRequest(
    requesterUserId,
    input
  );
}

export async function getMyRequests(
  requesterUserId: string
) {
  return findRequestsByUser(requesterUserId);
}

export async function getRequest(
  requestId: string,
  requesterUserId: string
) {
  const request = await findRequestById(requestId);

  if (!request) {
    throw new ApiError(
      404,
      "Resource request was not found."
    );
  }

  if (request.requesterUserId !== requesterUserId) {
    throw new ApiError(
      403,
      "You are not allowed to view this request."
    );
  }

  return request;
}

/*
 * This is for the Shelter/Dashboard side.
 *
 * The other member can use this endpoint later.
 */
export async function getRequestsForDashboard(
  status?: ResourceRequestStatus,
  district?: string
) {
  if (
    status &&
    !VALID_STATUSES.includes(status)
  ) {
    throw new ApiError(400, "Invalid request status.");
  }

  return findAllResourceRequests(
    status,
    district?.trim() || undefined
  );
}

export async function changeRequestStatus(
  requestId: string,
  status: ResourceRequestStatus
) {
  if (!VALID_STATUSES.includes(status)) {
    throw new ApiError(400, "Invalid request status.");
  }

  const request = await findRequestById(requestId);

  if (!request) {
    throw new ApiError(
      404,
      "Resource request was not found."
    );
  }

  const updated = await updateResourceRequestStatus(
    requestId,
    status
  );

  return updated;
}