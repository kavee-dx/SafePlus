import type { Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import {
  changeRequestStatus,
  createRequest,
  getMyRequests,
  getRequest,
  getRequestsForDashboard,
} from "../services/dildhara-resourceRequestService";
import type { ResourceRequestStatus } from "../models/dildhara-resourceRequest";

function getRequestId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export async function createResourceRequestController(
  req: Request,
  res: Response
) {
  const userId = req.user!.sub;

  const request = await createRequest(
    userId,
    req.body
  );

  res.status(201).json({
    message: "Resource request created successfully.",
    request,
  });
}

export async function getMyResourceRequestsController(
  req: Request,
  res: Response
) {
  const userId = req.user!.sub;

  const requests = await getMyRequests(userId);

  res.json({
    requests,
  });
}

export async function getMyResourceRequestController(
  req: Request,
  res: Response
) {
  const userId = req.user!.sub;
  const requestId = getRequestId(req.params.id);

  const request = await getRequest(
    requestId,
    userId
  );

  res.json({
    request,
  });
}

/*
 * Used by the Shelter Dashboard later.
 */
export async function getResourceRequestsDashboardController(
  req: Request,
  res: Response
) {
  const status =
    typeof req.query.status === "string"
      ? (req.query.status as ResourceRequestStatus)
      : undefined;

  const district =
    typeof req.query.district === "string"
      ? req.query.district
      : undefined;

  const requests =
    await getRequestsForDashboard(
      status,
      district
    );

  res.json({
    requests,
  });
}

/*
 * Used by the Shelter Dashboard later.
 */
export async function updateResourceRequestStatusController(
  req: Request,
  res: Response
) {
  const requestId = getRequestId(req.params.id);

  if (typeof req.body.status !== "string") {
    throw new ApiError(400, "Request status is required.");
  }

  const status = req.body.status as ResourceRequestStatus;

  const request =
    await changeRequestStatus(
      requestId,
      status
    );

  res.json({
    message: "Resource request status updated.",
    request,
  });
}