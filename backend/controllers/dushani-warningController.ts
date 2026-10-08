import type { Request, Response } from "express";

import { ApiError } from "../utils/apiError";
import {
  parseBoundary,
  validateBroadcast,
  validateDraft,
} from "../validators/dushani-alertValidators";
import { getWarningService } from "../services/dushani-warningService";
import { countAudienceByDistrict } from "../repositories/dushani-warningRepository";

const warningService = getWarningService();

/**
 * POST /api/warnings/draft - step 5, with the verified report chosen in step 1.
 */
export async function createDraft(req: Request, res: Response): Promise<void> {
  const warning = await warningService.createDraft(
    req.user!.sub,
    validateDraft(req.body)
  );

  res.status(201).json({
    message: "Warning saved as a draft.",
    warning,
  });
}

/**
 * PUT /api/warnings/:warningId/draft - draft/session recovery.
 */
export async function updateDraft(req: Request, res: Response): Promise<void> {
  const warning = await warningService.updateDraft(
    publicId(req.params.warningId),
    req.user!.sub,
    validateDraft(req.body, true)
  );

  res.json({ message: "Draft updated.", warning });
}

/**
 * DELETE /api/warnings/:warningId/draft
 */
export async function deleteDraft(req: Request, res: Response): Promise<void> {
  await warningService.deleteDraft(publicId(req.params.warningId), req.user!.sub);

  res.json({ message: "Draft discarded." });
}

/**
 * POST /api/warnings/audience - "who is actually going to receive this?"
 */
export async function previewAudience(
  req: Request,
  res: Response
): Promise<void> {
  const targetDistrict = String(req.body?.targetDistrict ?? "");

  if (!targetDistrict) {
    throw new ApiError(400, "Pick a target district first.", {
      targetDistrict: "Required.",
    });
  }

  res.json({
    audience: await warningService.previewAudience(
      targetDistrict,
      parseBoundary(req.body?.customBoundary)
    ),
  });
}

/**
 * POST /api/warnings/broadcast - step 6 plus dispatch (A1, E1, E3).
 */
export async function broadcastWarning(
  req: Request,
  res: Response
): Promise<void> {
  const { warningId, securityPin } = validateBroadcast(req.body);
  const warning = await warningService.broadcast(
    req.user!.sub,
    warningId,
    securityPin
  );

  res.json({
    message: `Warning ${warning.warningId} is live for ${warning.targetDistrict} District.`,
    warning,
  });
}

/**
 * POST /api/warnings/:warningId/stand-down
 */
export async function standDown(req: Request, res: Response): Promise<void> {
  const warning = await warningService.standDown(
    req.user!.sub,
    publicId(req.params.warningId)
  );

  res.json({ message: "Warning stood down.", warning });
}

/**
 * GET /api/warnings/:warningId - telemetry feed.
 */
export async function getWarning(req: Request, res: Response): Promise<void> {
  const warning = await warningService.getWarning(publicId(req.params.warningId));

  if (!warning) {
    throw new ApiError(404, "Warning not found.");
  }

  res.json({ warning });
}

/**
 * GET /api/warnings - the officer's drafts and issued warnings.
 */
export async function getOfficerWarnings(
  req: Request,
  res: Response
): Promise<void> {
  res.json({ warnings: await warningService.getWarningsByOfficer(req.user!.sub) });
}

/**
 * POST /api/warnings/message-preview - trilingual synthesis helper.
 */
export async function synthesizeMessages(
  req: Request,
  res: Response
): Promise<void> {
  const hazardType = String(req.body?.hazardType ?? "");
  const severityLevel = String(req.body?.severityLevel ?? "");
  const targetDistrict = String(req.body?.targetDistrict ?? "");

  if (!hazardType || !severityLevel || !targetDistrict) {
    throw new ApiError(400, "hazardType, severityLevel and targetDistrict are needed.");
  }

  res.json({
    messages: warningService.synthesizeMessages(
      hazardType,
      severityLevel,
      targetDistrict,
      req.body?.safetyInstructions ? String(req.body.safetyInstructions) : undefined
    ),
  });
}

/**
 * GET /api/warnings/coverage - shows the officer where alerted accounts exist
 * before they pick a target.
 */
export async function coverage(_req: Request, res: Response): Promise<void> {
  const rows = await countAudienceByDistrict();
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  res.json({ totalAlertedAccounts: total, byDistrict: rows });
}

function publicId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}
