import { Router } from "express";
import { requireAuth } from "../middlewares/dildhara-requireAuth";
import { ApiError } from "../utils/apiError";
import {
  agencyResponseController,
  confirmDeliveryController,
  createDispatchAssignmentController,
  createDispatchController,
  createTrackingUpdateController,
  departDispatchController,
  getDispatchController,
  getDispatchAssignmentOptionsController,
  listDispatchesController,
} from "../controllers/dildhara-reliefDispatchController";

const router = Router();

router.use(requireAuth);

router.use(
  (
    req: import("express").Request,
    _res: import("express").Response,
    next: import("express").NextFunction
  ) => {
    if (!req.user) {
      next(new ApiError(401, "Authentication required."));
      return;
    }

    if (req.user.role !== "COORDINATOR") {
      next(
        new ApiError(
          403,
          "Only coordinators can access relief dispatch operations."
        )
      );
      return;
    }

    next();
  }
);

// Create a dispatch from an existing RESERVED allocation.
router.post("/allocations/:allocationId", createDispatchController);

// List dispatches and real assignment options for coordinators.
router.get("/", listDispatchesController);
router.get("/assignment-options", getDispatchAssignmentOptionsController);

// Read dispatch details, assignments, tracking history, and confirmations.
router.get("/:dispatchId", getDispatchController);

// Record an agency's acceptance or rejection.
router.patch("/:dispatchId/agency-response", agencyResponseController);

// Add a vehicle/team/volunteer trip and the quantities assigned to it.
router.post("/:dispatchId/assignments", createDispatchAssignmentController);

// Record departure after agency acceptance and trip assignment.
router.patch("/:dispatchId/depart", departDispatchController);

// Add a timestamped location/status report while in transit.
router.post("/:dispatchId/tracking", createTrackingUpdateController);

// Confirm delivered, damaged, and missing quantities.
router.post("/:dispatchId/delivery-confirmation", confirmDeliveryController);

export default router;