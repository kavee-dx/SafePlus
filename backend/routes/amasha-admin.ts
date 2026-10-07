import { Router } from "express";

import {
  approve,
  detail,
  list,
  login,
  me,
  reject,
  stats,
} from "../controllers/amasha-adminController";
import { requireSuperAdmin } from "../middlewares/amasha-auth";

const router = Router();

// Public
router.post("/login", login);

// Protected (Super Admin only)
router.get("/me", requireSuperAdmin, me);
router.get("/stats", requireSuperAdmin, stats);
router.get("/registrations", requireSuperAdmin, list);
router.get("/registrations/:id", requireSuperAdmin, detail);
router.post("/registrations/:id/approve", requireSuperAdmin, approve);
router.post("/registrations/:id/reject", requireSuperAdmin, reject);

export default router;
