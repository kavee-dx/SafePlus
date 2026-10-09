import type { Request, Response } from "express";

import { getHazardReportService } from "../services/dushani-hazardReportService";

const hazardReportService = getHazardReportService();

/**
 * GET /api/notifications - feeds the bell in the top right of the portal.
 */
export async function listNotifications(
  req: Request,
  res: Response
): Promise<void> {
  const { items, unreadCount } = await hazardReportService.getNotifications(
    req.user!.sub
  );

  res.json({ notifications: items, unreadCount });
}

/**
 * PUT /api/notifications/:notificationId/read
 */
export async function markNotificationRead(
  req: Request,
  res: Response
): Promise<void> {
  const raw = req.params.notificationId;
  const notificationId = Array.isArray(raw) ? raw[0] : raw;

  await hazardReportService.markNotificationAsRead(notificationId, req.user!.sub);

  res.json({ message: "Marked as read." });
}
