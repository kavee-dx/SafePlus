import { Router } from "express";
import { requireAuth } from "../middlewares/dildhara-requireAuth";
import {
  createResourceRequestController,
  getMyResourceRequestsController,
  getMyResourceRequestController,
  getResourceRequestsDashboardController,
  updateResourceRequestStatusController,
} from "../controllers/dildhara-resourceRequestController";

const router = Router();

/*
 * Citizen
 */

/*
 * POST /api/resource-requests
 */
router.post(
  "/",
  requireAuth,
  createResourceRequestController
);

/*
 * GET /api/resource-requests/my
 */
router.get(
  "/my",
  requireAuth,
  getMyResourceRequestsController
);

/*
 * GET /api/resource-requests/my/:id
 */
router.get(
  "/my/:id",
  requireAuth,
  getMyResourceRequestController
);

/*
 * Shelter/Dashboard
 *
 * Example:
 * GET /api/resource-requests/dashboard
 *
 * GET /api/resource-requests/dashboard?status=PENDING
 *
 * GET /api/resource-requests/dashboard?district=Colombo
 *
 * GET /api/resource-requests/dashboard?status=PENDING&district=Colombo
 */
router.get(
  "/dashboard",
  requireAuth,
  getResourceRequestsDashboardController
);

/*
 * Shelter/Dashboard
 *
 * PATCH /api/resource-requests/:id/status
 */
router.patch(
  "/:id/status",
  requireAuth,
  updateResourceRequestStatusController
);

export default router;