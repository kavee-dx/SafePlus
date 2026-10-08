import { Router } from "express";

import { pinStatus, setPin } from "../controllers/dushani-pinController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";
import { requireDmcOfficer } from "../middlewares/dushani-requireOfficer";

const router = Router();

router.use(requireAuth, requireDmcOfficer);

// GET /api/clearance-pin - has this officer created a PIN yet?
router.get("/", pinStatus);

// PUT /api/clearance-pin - set or change the operational clearance PIN
router.put("/", setPin);

export default router;
