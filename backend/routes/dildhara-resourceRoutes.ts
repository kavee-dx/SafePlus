import { Router } from "express";

import { requireAuth } from "../middlewares/dildhara-requireAuth";

import {
  createResource,
  deleteResource,
  getResource,
  listMyResources,
  updateResource,
} from "../controllers/dildhara-resourceController";

const router = Router();

router.use(requireAuth);

router.post("/", createResource);

router.get("/my", listMyResources);

router.get("/:id", getResource);

router.patch("/:id", updateResource);

router.delete("/:id", deleteResource);

export default router;