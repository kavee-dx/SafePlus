import { Router } from "express";

import { createRegistration } from "../controllers/registrationController";

const router = Router();

// POST /api/registrations/:type
// type is a key of REGISTRATION_TYPES in models/registration.ts
router.post("/:type", createRegistration);

export default router;
