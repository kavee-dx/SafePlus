import { Router } from "express";

import {
  listNotifications,
  markNotificationRead,
} from "../controllers/dushani-notificationController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";

const router = Router();

router.use(requireAuth);

// GET /api/notifications - feeds the bell, newest first with an unread count
router.get("/", listNotifications);

// PUT /api/notifications/:notificationId/read
router.put("/:notificationId/read", markNotificationRead);

export default router;
