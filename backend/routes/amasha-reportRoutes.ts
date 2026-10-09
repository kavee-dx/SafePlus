import { Router } from "express";

import {
  createDetailed,
  mineDetail,
  mineList,
  queueDetail,
  queueInfoRequired,
  queuePending,
  queueVerified,
  queueRejected,
  requestInfo,
  resubmit,
} from "../controllers/amasha-reportController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";
import { requireVerifier } from "../middlewares/dushani-requireOfficer";

const router = Router();

router.use(requireAuth);

// Citizen side. Every path is two segments deep so the dushani
// GET /reports/:reportId route (registered first) cannot swallow them.
router.post("/detailed", createDetailed);
router.get("/mine/list", mineList);
router.get("/mine/:reportId", mineDetail);
router.put("/mine/:reportId/resubmit", resubmit);

// Officer side (DMC + district officers).
router.get("/queue/pending", requireVerifier, queuePending);
router.get("/queue/info-required", requireVerifier, queueInfoRequired);
router.get("/queue/verified", requireVerifier, queueVerified);
router.get("/queue/rejected", requireVerifier, queueRejected);
router.get("/queue/:reportId", requireVerifier, queueDetail);
router.put("/queue/:reportId/request-info", requireVerifier, requestInfo);

export default router;
