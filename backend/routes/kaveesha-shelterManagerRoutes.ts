import { Router } from "express";

import {
  analytics,
  confirm,
  departure,
  expectedArrivals,
  profile,
  shelters,
  stream,
  walkIn,
} from "../controllers/kaveesha-shelterManagerController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";
import { requireShelterManager } from "../middlewares/kaveesha-requireShelterManager";

const router = Router();

// The whole workspace is a Shelter Manager's own: a login first, then the role
// guard, then every handler narrows to the shelters assigned to that account.
router.use(requireAuth, requireShelterManager);

router.get("/profile", profile);
router.get("/shelters", shelters);
router.get("/analytics", analytics);
router.get("/expected-arrivals", expectedArrivals);
router.get("/stream", stream);
router.post("/allocations/:id/confirm-arrival", confirm);
router.post("/shelters/:id/walk-in", walkIn);
router.post("/shelters/:id/departure", departure);

export default router;
