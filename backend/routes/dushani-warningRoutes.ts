import { Router } from "express";

import {
  broadcastWarning,
  coverage,
  createDraft,
  deleteDraft,
  deleteWarning,
  extendExpiry,
  getOfficerWarnings,
  getWarning,
  previewAudience,
  standDown,
  synthesizeMessages,
  updateDraft,
} from "../controllers/dushani-warningController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";
import { requireDmcOfficer } from "../middlewares/dushani-requireOfficer";

const router = Router();

router.use(requireAuth, requireDmcOfficer);

// POST /api/warnings/draft - save the wizard work without sending anything
router.post("/draft", createDraft);

// POST /api/warnings/audience - who would receive this, before sending it
router.post("/audience", previewAudience);

// POST /api/warnings/message-preview - trilingual drafting helper
router.post("/message-preview", synthesizeMessages);

// POST /api/warnings/broadcast - PIN check plus multi-channel dispatch
router.post("/broadcast", broadcastWarning);

// GET /api/warnings/coverage - alerted accounts per district
router.get("/coverage", coverage);

// GET /api/warnings - this officer's drafts and issued warnings
router.get("/", getOfficerWarnings);

// PUT /api/warnings/:warningId/draft - draft recovery
router.put("/:warningId/draft", updateDraft);

// DELETE /api/warnings/:warningId/draft
router.delete("/:warningId/draft", deleteDraft);

// DELETE /api/warnings/:warningId - delete an issued warning
router.delete("/:warningId", deleteWarning);

// POST /api/warnings/:warningId/stand-down - close an active warning
router.post("/:warningId/stand-down", standDown);

// POST /api/warnings/:warningId/extend-expiry - keep a warning active longer
router.post("/:warningId/extend-expiry", extendExpiry);

// GET /api/warnings/:warningId - delivery telemetry
router.get("/:warningId", getWarning);

export default router;
