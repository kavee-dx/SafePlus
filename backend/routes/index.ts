import { Router } from "express";

import registrationRoutes from "./registrations";
import adminRoutes from "./amasha-admin";
import authRoutes from "./dildhara-authRoutes";
import profileRoutes from "./dildhara-profileRoutes";
import warningRoutes from "./dushani-warningRoutes";
import hazardReportRoutes from "./dushani-hazardReportRoutes";
import amashaReportRoutes from "./amasha-reportRoutes";
import notificationRoutes from "./dushani-notificationRoutes";
import geoRoutes from "./dushani-geoRoutes";
import pinRoutes from "./dushani-pinRoutes";
import alertTargetRoutes from "./dushani-alertTargetRoutes";
import alertInboxRoutes from "./dushani-alertInboxRoutes";
import resourceRoutes from "./dildhara-resourceRoutes";
import rescueOrganizationRoutes from "./kaveesha-rescueOrgRoutes";
import rescueTeamRoutes from "./kaveesha-rescueTeamRoutes";
import rescueDispatchRoutes from "./kaveesha-dispatchRoutes";

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
router.use("/warnings", warningRoutes);
router.use("/reports", amashaReportRoutes);
router.use("/reports", hazardReportRoutes);
router.use("/notifications", notificationRoutes);
router.use("/geo", geoRoutes);
router.use("/clearance-pin", pinRoutes);
router.use("/alert-target", alertTargetRoutes);
router.use("/alert-inbox", alertInboxRoutes);
router.use("/resources", resourceRoutes);
router.use("/rescue-organization", rescueOrganizationRoutes);
router.use("/rescue-teams", rescueTeamRoutes);
router.use("/rescue-dispatch", rescueDispatchRoutes);

export default router;
