import { Router } from "express";

import { getMe, updateMe } from "../controllers/dildhara-profileController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";

const router = Router();

// GET /api/profile/me
router.get("/me", requireAuth, getMe);

// PATCH /api/profile/me
router.patch("/me", requireAuth, updateMe);

export default router;