import type { Request, Response } from "express";

import { validatePinSetup } from "../validators/dushani-alertValidators";
import { getOfficerPinService } from "../services/dushani-officerPinService";
import { getAuditLogger } from "../services/dushani-auditLoggerService";

const pinService = getOfficerPinService();
const auditLogger = getAuditLogger();

/**
 * GET /api/clearance-pin - tells the wizard whether the officer still has to
 * create a PIN before they can authorize a broadcast.
 */
export async function pinStatus(req: Request, res: Response): Promise<void> {
  res.json(await pinService.getStatus(req.user!.sub));
}

/**
 * PUT /api/clearance-pin - self-service set or change. There is no default PIN
 * and no admin-issued one.
 */
export async function setPin(req: Request, res: Response): Promise<void> {
  const { pin, currentPin } = validatePinSetup(req.body);
  const { pinUpdatedAt } = await pinService.setPin(req.user!.sub, pin, currentPin);

  await auditLogger.logImmediate({
    warningId: null,
    officerId: req.user!.sub,
    action: "PIN_SET",
    entryPoint: "CLEARANCE_PIN",
    details: { changed: Boolean(currentPin) },
  });

  res.json({
    message: currentPin
      ? "Clearance PIN changed."
      : "Clearance PIN set. You can now authorize a broadcast.",
    pinUpdatedAt,
  });
}
