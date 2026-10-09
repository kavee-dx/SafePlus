import { Router } from "express";

import { saveMyAlertTarget } from "../controllers/dushani-alertTargetController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";

const router = Router();

router.use(requireAuth);

// PUT /api/alert-target - the app stores its push token and last known fix
router.put("/", saveMyAlertTarget);

export default router;
