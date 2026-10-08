import { Router } from "express";

import {
  availability,
  dashboard,
  organizations,
  resubmit,
} from "../controllers/kaveesha-rescueTeamController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";
import { requireTeamLeader } from "../middlewares/kaveesha-requireTeamLeader";

const router = Router();

// Public: the registration form may only offer verified organizations.
router.get("/organizations", organizations);

router.get("/dashboard", requireAuth, requireTeamLeader, dashboard);
router.post("/resubmit", requireAuth, requireTeamLeader, resubmit);
router.put("/availability", requireAuth, requireTeamLeader, availability);

export default router;
