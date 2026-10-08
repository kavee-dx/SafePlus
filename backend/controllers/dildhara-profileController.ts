import type { Request, Response } from "express";

import { readStringPayload } from "../validators/registrationValidators";
import { getMyProfile } from "../services/dildhara-profileService";
import { updateMyProfile } from "../services/dildhara-profileUpdateService";

export async function getMe(req: Request, res: Response): Promise<void> {
  const profile = await getMyProfile(req.user!.sub);
  res.status(200).json(profile);
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const profile = await updateMyProfile(
    req.user!.sub,
    readStringPayload(req.body)
  );

  res.status(200).json({ message: "Profile updated.", ...profile });
}