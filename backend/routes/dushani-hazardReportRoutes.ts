import { Router } from "express";

import {
  createReport,
  getReport,
  listMyReports,
  listPendingReports,
  listVerifiedReports,
  verifyReport,
} from "../controllers/dushani-hazardReportController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";
import { requireVerifier } from "../middlewares/dushani-requireOfficer";

const router = Router();

router.use(requireAuth);

// POST /api/reports - citizens raise the ground report
router.post("/", createReport);

// GET /api/reports/my - the citizen's own reports and their outcome
router.get("/my", listMyReports);

// GET /api/reports/pending - the verification queue
router.get("/pending", requireVerifier, listPendingReports);

// GET /api/reports/verified - step 1 of the wizard: choose the incident
router.get("/verified", requireVerifier, listVerifiedReports);

// PUT /api/reports/:reportId/verify - the gate every warning depends on
router.put("/:reportId/verify", requireVerifier, verifyReport);

// GET /api/reports/:reportId - full report for the review and wizard screens
router.get("/:reportId", requireVerifier, getReport);

export default router;
