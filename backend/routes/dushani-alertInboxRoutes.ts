import { Router } from "express";

import {
  listMyAlerts,
  markMyAlertRead,
} from "../controllers/dushani-alertInboxController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";

const router = Router();

router.use(requireAuth);

// GET /api/alert-inbox - the SMS-style emergency alerts delivered to this phone
router.get("/", listMyAlerts);

// PUT /api/alert-inbox/:messageId/read
router.put("/:messageId/read", markMyAlertRead);

export default router;
