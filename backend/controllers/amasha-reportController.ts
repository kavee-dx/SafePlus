import type { Request, Response } from "express";

import {
  validateDetailedSubmission,
  validateRequestInfo,
  validateResubmission,
} from "../validators/amasha-reportValidators";
import { getReportExtensionService } from "../services/amasha-reportService";

const reports = getReportExtensionService();

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

/** POST /api/reports/detailed - citizen submits the multi-step ground report. */
export async function createDetailed(req: Request, res: Response): Promise<void> {
  const report = await reports.submit(
    req.user!.sub,
    validateDetailedSubmission(req.body)
  );

  res.status(201).json({
    message:
      "Report received. A DMC officer is checking it before any alert is issued.",
    report,
  });
}

/** GET /api/reports/mine/:reportId - citizen opens one of their own reports. */
export async function mineDetail(req: Request, res: Response): Promise<void> {
  const report = await reports.detailForReporter(
    param(req.params.reportId),
    req.user!.sub
  );

  res.json({ report });
}

/** PUT /api/reports/mine/:reportId/resubmit - A2: citizen answers the officer. */
export async function resubmit(req: Request, res: Response): Promise<void> {
  const report = await reports.resubmit(
    param(req.params.reportId),
    req.user!.sub,
    validateResubmission(req.body)
  );

  res.json({
    message: "Update received. Your report is back in the verification queue.",
    report,
  });
}

/** GET /api/reports/mine/list - citizen's own reports with UC-02 fields. */
export async function mineList(req: Request, res: Response): Promise<void> {
  res.json({ reports: await reports.listMine(req.user!.sub) });
}

/** GET /api/reports/queue/pending - verification queue for officers. */
export async function queuePending(req: Request, res: Response): Promise<void> {
  const district = req.query.district ? String(req.query.district) : undefined;

  res.json({ reports: await reports.listPending(district) });
}

/** GET /api/reports/queue/info-required - reports waiting on the citizen. */
export async function queueInfoRequired(req: Request, res: Response): Promise<void> {
  const district = req.query.district ? String(req.query.district) : undefined;

  res.json({ reports: await reports.listInfoRequired(district) });
}

/** GET /api/reports/queue/verified - verified reports ready for a warning. */
export async function queueVerified(_req: Request, res: Response): Promise<void> {
  res.json({ reports: await reports.listVerified() });
}

/** GET /api/reports/queue/rejected - rejected reports (A3, still stored). */
export async function queueRejected(_req: Request, res: Response): Promise<void> {
  res.json({ reports: await reports.listRejected() });
}

/** GET /api/reports/queue/:reportId - full report for the detail/verify pages. */
export async function queueDetail(req: Request, res: Response): Promise<void> {
  res.json({ report: await reports.detailForOfficer(param(req.params.reportId)) });
}

/** PUT /api/reports/queue/:reportId/request-info - A2 from the officer side. */
export async function requestInfo(req: Request, res: Response): Promise<void> {
  const { reason } = validateRequestInfo(req.body);

  const report = await reports.requestMoreInfo(
    param(req.params.reportId),
    req.user!.sub,
    reason
  );

  res.json({
    message: "The citizen has been asked for more information.",
    report,
  });
}
