import { Router } from "express";

import {
  allocate,
  analytics,
  cancelAllocation,
  citizenNearby,
  createGroupHandler,
  createManager,
  createShelter,
  groups,
  managers,
  recommend,
  shelter,
  shelters,
  stream,
  updateManager,
  updateShelter,
} from "../controllers/kaveesha-shelterController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";
import { requireDistrictBoard } from "../middlewares/kaveesha-requireDistrictBoard";

const router = Router();

// Every shelter endpoint needs a signed-in account. On top of that the officer
// board needs the district guard; the citizen browse needs only the login.
router.use(requireAuth);

// ---- citizen (any signed-in account) ----
// Placed before the officer :id routes so "nearby" is never read as a shelter id.
router.get("/shelters/nearby", citizenNearby);

// ---- officer: shelters ----
// The literal sub-paths come before /:id for the same reason as above.
router.get("/shelters/recommend", requireDistrictBoard, recommend);
router.get("/shelters/analytics", requireDistrictBoard, analytics);
router.get("/shelters/stream", requireDistrictBoard, stream);
router.get("/shelters", requireDistrictBoard, shelters);
router.post("/shelters", requireDistrictBoard, createShelter);
router.get("/shelters/:id", requireDistrictBoard, shelter);
router.patch("/shelters/:id", requireDistrictBoard, updateShelter);

// ---- officer: evacuee groups and allocation ----
router.get("/shelter-groups", requireDistrictBoard, groups);
router.post("/shelter-groups", requireDistrictBoard, createGroupHandler);
router.post("/shelter-groups/:id/allocate", requireDistrictBoard, allocate);
router.post("/shelter-groups/:id/cancel", requireDistrictBoard, cancelAllocation);

// ---- officer: shelter manager accounts ----
router.get("/shelter-managers", requireDistrictBoard, managers);
router.post("/shelter-managers", requireDistrictBoard, createManager);
router.patch("/shelter-managers/:id", requireDistrictBoard, updateManager);

export default router;
