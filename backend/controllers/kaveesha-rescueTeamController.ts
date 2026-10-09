import type { Request, Response } from "express";

import { readStringPayload } from "../validators/registrationValidators";
import {
  getDistrictRescueBoard,
  getTeamLeaderDashboard,
  listVerifiedOrganizationsForForm,
  resubmitRescueTeam,
  updateTeamAvailability,
} from "../services/kaveesha-rescueTeamService";

function userId(req: Request): string {
  return String(req.user?.sub);
}

// GET /api/rescue-teams/organizations - verified organizations only
export async function organizations(
  _req: Request,
  res: Response
): Promise<void> {
  const organizations = await listVerifiedOrganizationsForForm();

  res.status(200).json({ data: organizations });
}

// GET /api/rescue-teams/dashboard
export async function dashboard(req: Request, res: Response): Promise<void> {
  const data = await getTeamLeaderDashboard(userId(req));

  res.status(200).json({ data });
}

// GET /api/rescue-teams/district-board?scope=district|all
export async function districtBoard(
  req: Request,
  res: Response
): Promise<void> {
  const scope = String(req.query.scope ?? "");

  const data = await getDistrictRescueBoard(userId(req), scope);

  res.status(200).json({ data });
}

// POST /api/rescue-teams/resubmit
export async function resubmit(req: Request, res: Response): Promise<void> {
  const data = await resubmitRescueTeam(
    userId(req),
    readStringPayload(req.body)
  );

  res
    .status(200)
    .json({ message: "Your team has been sent back for review.", data });
}

// PUT /api/rescue-teams/availability
export async function availability(req: Request, res: Response): Promise<void> {
  const body = req.body as { availability?: string };

  const data = await updateTeamAvailability(
    userId(req),
    String(body.availability ?? "")
  );

  res.status(200).json({ message: "Availability updated.", data });
}
