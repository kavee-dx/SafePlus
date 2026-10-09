import type { Request, Response } from "express";

import { getAlertInboxService } from "../services/dushani-alertInboxService";

const alertInboxService = getAlertInboxService();

/**
 * GET /api/alert-inbox - the emergency texts this phone has received.
 */
export async function listMyAlerts(req: Request, res: Response): Promise<void> {
  const inbox = await alertInboxService.getInbox(req.user!.sub);

  res.json(inbox);
}

/**
 * PUT /api/alert-inbox/:messageId/read
 */
export async function markMyAlertRead(
  req: Request,
  res: Response
): Promise<void> {
  const raw = req.params.messageId;
  const messageId = Array.isArray(raw) ? raw[0] : raw;

  await alertInboxService.markAsRead(messageId, req.user!.sub);

  res.json({ message: "Marked as read." });
}
