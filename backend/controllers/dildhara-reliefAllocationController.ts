
import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { ApiError } from "../utils/apiError";

import {
  cancelDraftOrReservation,
  createAllocation,
  getAllocation,
  getAllAllocations,
  getAvailableResources,
  reserveDraftAllocation,
} from "../services/dildhara-reliefAllocationService";

function getCoordinator(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required.");
  }

  if (req.user.role !== "COORDINATOR") {
    throw new ApiError(
      403,
      "Only coordinators can manage relief allocations."
    );
  }

  return req.user;
}

function getId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export async function listAvailableResources(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    getCoordinator(req);

    const resources = await getAvailableResources();

    res.status(200).json({ resources });
  } catch (error) {
    next(error);
  }
}

export async function listAllocations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    getCoordinator(req);

    const allocations = await getAllAllocations();

    res.status(200).json({ allocations });
  } catch (error) {
    next(error);
  }
}

export async function getAllocationDetails(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    getCoordinator(req);

    const allocation = await getAllocation(
      getId(req.params.id)
    );

    res.status(200).json({ allocation });
  } catch (error) {
    next(error);
  }
}

export async function createAllocationDraft(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = getCoordinator(req);

    const allocation = await createAllocation(
      user.sub,
      req.body as Record<string, unknown>
    );

    res.status(201).json({
      message: "Allocation draft created successfully.",
      allocation,
    });
  } catch (error) {
    next(error);
  }
}

export async function reserveAllocationDraft(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    getCoordinator(req);

    const allocation = await reserveDraftAllocation(
      getId(req.params.id)
    );

    res.status(200).json({
      message: "Resource quantities reserved successfully.",
      allocation,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelAllocationDraft(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    getCoordinator(req);

    const allocation = await cancelDraftOrReservation(
      getId(req.params.id)
    );

    res.status(200).json({
      message: "Allocation cancelled successfully.",
      allocation,
    });
  } catch (error) {
    next(error);
  }
}