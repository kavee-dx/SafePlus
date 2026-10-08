import type { Request, Response } from "express";

import {
  approveRescueTeam,
  getRescueOrganizationDashboard,
  rejectRescueTeam,
} from "../services/kaveesha-rescueOrgService";

// GET /api/rescue-organization/dashboard
export async function dashboard(
  req: Request,
  res: Response
): Promise<void> {
  const data = await getRescueOrganizationDashboard(String(req.user?.sub));

  res.status(200).json({ data });
}

// POST /api/rescue-organization/teams/:userId/approve
export async function approveTeam(
  req: Request,
  res: Response
): Promise<void> {
  const team = await approveRescueTeam(
    String(req.user?.sub),
    String(req.params.userId)
  );

  res.status(200).json({
    message: `${team.teamName} has been verified.`,
    data: team,
  });
}

// POST /api/rescue-organization/teams/:userId/reject
export async function rejectTeam(req: Request, res: Response): Promise<void> {
  const body = req.body as { reason?: string };

  const team = await rejectRescueTeam(
    String(req.user?.sub),
    String(req.params.userId),
    String(body.reason ?? "")
  );

  res.status(200).json({
    message: `${team.teamName} has been rejected. The leader can correct and resubmit.`,
    data: team,
  });
}
