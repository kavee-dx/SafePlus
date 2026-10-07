import type { Request, Response } from "express";

import { getMyProfile } from "../services/dildhara-profileService";

export async function getMe(req: Request, res: Response): Promise<void> {
  const profile = await getMyProfile(req.user!.sub);
  res.status(200).json(profile);
}