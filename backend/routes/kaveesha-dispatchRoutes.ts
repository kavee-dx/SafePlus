import { Router } from "express";

import {
  accept,
  cancel,
  close,
  dispatch,
  dispatches,
  incident,
  incidents,
  mine,
  recommendations,
  reopen,
  stages,
  status,
  stream,
} from "../controllers/kaveesha-dispatchController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";
import { requireDistrictBoard } from "../middlewares/kaveesha-requireDistrictBoard";
import { requireTeamLeader } from "../middlewares/kaveesha-requireTeamLeader";

const router = Router();

// Everything below needs a signed-in account; the two guards decide who may do
// what, and the service narrows each answer to that officer's own district.
router.use(requireAuth);

// Officer: incidents, ranking, tasking, standing down.
router.get("/incidents", requireDistrictBoard, incidents);
router.get("/incidents/:reportId", requireDistrictBoard, incident);
router.get(
  "/incidents/:reportId/recommendations",
  requireDistrictBoard,
  recommendations
);
// Officer: the district's own acceptance of a verified incident. The DMC has
// already decided it is true; this says the district is working it.
router.post("/incidents/:reportId/accept", requireDistrictBoard, accept);
router.post("/incidents/:reportId/dispatch", requireDistrictBoard, dispatch);
// The district's closing line, and the undo for a mis-click on it.
router.post("/incidents/:reportId/close", requireDistrictBoard, close);
router.post("/incidents/:reportId/reopen", requireDistrictBoard, reopen);
router.get("/dispatches", requireDistrictBoard, dispatches);
router.post("/dispatches/:id/cancel", requireDistrictBoard, cancel);

// Live feed of this officer's district, for the board that watches a mission move.
router.get("/stream", requireDistrictBoard, stream);

// Team leader: their own assignment, forward only.
router.get("/mine", requireTeamLeader, mine);
router.post("/dispatches/:id/status", requireTeamLeader, status);

// Shared: the stage names, so a client never keeps its own copy.
router.get("/stages", stages);

export default router;
