import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import {
  assignDispatchTrip,
  createDispatchForAllocation,
  getDispatchAssignmentOptions,
  getDispatchDetails,
  getDispatches,
  markDispatchDeparted,
  recordAgencyResponse,
  recordDeliveryConfirmation,
  recordTracking,
} from "../services/dildhara-reliefDispatchService";

function getUserId(req: Request): string {
  const userId = req.user?.sub;

  if (!userId) {
    throw new ApiError(401, "Authentication required.");
  }

  return userId;
}

export async function createDispatchController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const dispatch = await createDispatchForAllocation(
      req.params.allocationId,
      getUserId(req),
      req.body ?? {}
    );

    res.status(201).json({
      message: "Dispatch plan created successfully.",
      dispatch,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDispatchController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const dispatch = await getDispatchDetails(req.params.dispatchId);
    res.json({ dispatch });
  } catch (error) {
    next(error);
  }
}

export async function listDispatchesController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const dispatches = await getDispatches();
    res.json({ dispatches });
  } catch (error) {
    next(error);
  }
}

export async function getDispatchAssignmentOptionsController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const options = await getDispatchAssignmentOptions();
    res.json(options);
  } catch (error) {
    next(error);
  }
}

export async function agencyResponseController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const dispatch = await recordAgencyResponse(
      req.params.dispatchId,
      getUserId(req),
      req.body ?? {}
    );

    res.json({
      message: "Agency response recorded successfully.",
      dispatch,
    });
  } catch (error) {
    next(error);
  }
}

export async function createDispatchAssignmentController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const assignment = await assignDispatchTrip(
      req.params.dispatchId,
      req.body ?? {}
    );

    res.status(201).json({
      message: "Dispatch trip assigned successfully.",
      assignment,
    });
  } catch (error) {
    next(error);
  }
}

export async function departDispatchController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const dispatch = await markDispatchDeparted(
      req.params.dispatchId,
      getUserId(req)
    );

    res.json({
      message: "Dispatch departure recorded.",
      dispatch,
    });
  } catch (error) {
    next(error);
  }
}

export async function createTrackingUpdateController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tracking = await recordTracking(
      req.params.dispatchId,
      getUserId(req),
      req.body ?? {}
    );

    res.status(201).json({
      message: "Tracking update recorded.",
      tracking,
    });
  } catch (error) {
    next(error);
  }
}

export async function confirmDeliveryController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const dispatch = await recordDeliveryConfirmation(
      req.params.dispatchId,
      getUserId(req),
      req.body ?? {}
    );

    res.json({
      message: "Delivery confirmation recorded.",
      dispatch,
    });
  } catch (error) {
    next(error);
  }
}