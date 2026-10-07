import { Router } from "express";

import { getMe } from "../controllers/dildhara-profileController";
import { requireAuth } from "../middlewares/dildhara-requireAuth";

const router = Router();

// GET /api/profile/me
router.get("/me", requireAuth, getMe);

export default router;