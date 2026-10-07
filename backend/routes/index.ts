import { Router } from "express";

import registrationRoutes from "./registrations";
import adminRoutes from "./amasha-admin";
import authRoutes from "./dildhara-authRoutes";
import profileRoutes from "./dildhara-profileRoutes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    message: "SafePlus API is healthy",
  });
});

router.use("/registrations", registrationRoutes);
router.use("/admin", adminRoutes);
router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);

export default router;
