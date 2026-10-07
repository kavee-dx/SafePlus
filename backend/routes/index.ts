import { Router } from "express";

import registrationRoutes from "./registrations";
import adminRoutes from "./amasha-admin";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    message: "SafePlus API is healthy",
  });
});

router.use("/registrations", registrationRoutes);
router.use("/admin", adminRoutes);

export default router;
