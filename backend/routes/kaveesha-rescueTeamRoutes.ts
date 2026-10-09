import { Router } from "express";

import {
  availability,
  dashboard,
  districtBoard,
  organizations,
  resubmit,
} from "../controllers/kaveesha-rescueTeamController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";
import { requireTeamLeader } from "../middlewares/kaveesha-requireTeamLeader";
import { requireDistrictBoard } from "../middlewares/kaveesha-requireDistrictBoard";

const router = Router();

// Public: the registration form may only offer verified organizations.
router.get("/organizations", organizations);

// District/DMC officers: approved teams for tasking, grouped by disaster and
// organization. Declared before the leader routes so the guard is explicit.
router.get("/district-board", requireAuth, requireDistrictBoard, districtBoard);

router.get("/dashboard", requireAuth, requireTeamLeader, dashboard);
router.post("/resubmit", requireAuth, requireTeamLeader, resubmit);
router.put("/availability", requireAuth, requireTeamLeader, availability);

export default router;
