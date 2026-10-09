
import { Router } from "express";

import { requireAuth } from "../middlewares/dildhara-requireAuth";
import { ApiError } from "../utils/apiError";

import {
  cancelAllocationDraft,
  createAllocationDraft,
  getAllocationDetails,
  listAllocations,
  listAvailableResources,
  reserveAllocationDraft,
} from "../controllers/dildhara-reliefAllocationController";

const router = Router();

router.use(requireAuth);

function requireCoordinator(
  req: import("express").Request,
  _res: import("express").Response,
  next: import("express").NextFunction
): void {
  if (!req.user) {
    next(new ApiError(401, "Authentication required."));
    return;
  }

  if (req.user.role !== "COORDINATOR") {
    next(
      new ApiError(
        403,
        "Only coordinators can access relief operations."
      )
    );
    return;
  }

  next();
}

router.use(requireCoordinator);

router.get("/resources/available", listAvailableResources);

router.get("/allocations", listAllocations);

router.post("/allocations", createAllocationDraft);

router.get("/allocations/:id", getAllocationDetails);

router.post("/allocations/:id/reserve", reserveAllocationDraft);

router.post("/allocations/:id/cancel", cancelAllocationDraft);

export default router;