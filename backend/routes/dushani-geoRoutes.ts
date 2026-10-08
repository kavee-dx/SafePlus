import { Router } from "express";

import {
  getDistrictBoundary,
  listDistricts,
  resolveDistrict,
  validateBoundary,
} from "../controllers/dushani-geoController";

const router = Router();

router.get("/districts", listDistricts);
router.get("/districts/:district/boundary", getDistrictBoundary);
router.post("/resolve", resolveDistrict);
router.post("/validate-boundary", validateBoundary);

export default router;
