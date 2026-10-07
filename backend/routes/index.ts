import { Router } from "express";

import registrationRoutes from "./registrations";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    message: "SafePlus API is healthy",
  });
});

router.use("/registrations", registrationRoutes);

export default router;
