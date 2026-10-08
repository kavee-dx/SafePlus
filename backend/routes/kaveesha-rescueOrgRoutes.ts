import { Router } from "express";

import {
  approveTeam,
  dashboard,
  rejectTeam,
} from "../controllers/kaveesha-rescueOrgController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";
import { requireRescueOrganizationAdmin } from "../middlewares/kaveesha-requireRescueOrganization";

const router = Router();

router.use(requireAuth, requireRescueOrganizationAdmin);

// GET /api/rescue-organization/dashboard - organization profile, teams and stats
router.get("/dashboard", dashboard);

// POST /api/rescue-organization/teams/:userId/approve - verify a rescue team
router.post("/teams/:userId/approve", approveTeam);

// POST /api/rescue-organization/teams/:userId/reject - reject with a reason
router.post("/teams/:userId/reject", rejectTeam);

export default router;
