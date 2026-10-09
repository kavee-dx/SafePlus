import type { Request, Response } from "express";

import {
  validateReportSubmission,
  validateReportVerification,
} from "../validators/dushani-alertValidators";
import { getHazardReportService } from "../services/dushani-hazardReportService";

const hazardReportService = getHazardReportService();

/**
 * POST /api/reports - a citizen raises a ground report.
 */
export async function createReport(req: Request, res: Response): Promise<void> {
  const report = await hazardReportService.createReport(
    req.user!.sub,
    validateReportSubmission(req.body)
  );

  res.status(201).json({
    message:
      "Report received. A DMC officer is checking it before any alert is issued.",
    report,
  });
}

/**
 * PUT /api/reports/:reportId/verify - verification is the gate for warnings.
 */
export async function verifyReport(req: Request, res: Response): Promise<void> {
  const report = await hazardReportService.verifyReport(
    param(req.params.reportId),
    req.user!.sub,
    validateReportVerification(req.body)
  );

  res.json({
    message:
      report.status === "VERIFIED"
        ? "Report verified. Officers can now issue a warning for it."
        : "Report rejected.",
    report,
  });
}

/**
 * GET /api/reports/pending - the verification queue.
 */
export async function listPendingReports(
  req: Request,
  res: Response
): Promise<void> {
  const district = req.query.district ? String(req.query.district) : undefined;

  res.json({
    reports: await hazardReportService.listPendingReports(district),
  });
}

/**
 * GET /api/reports/verified - step 1 of the wizard: pick the incident.
 */
export async function listVerifiedReports(
  _req: Request,
  res: Response
): Promise<void> {
  res.json({ reports: await hazardReportService.listVerifiedReports() });
}

/**
 * GET /api/reports/mine - the citizen's own reports and their outcomes.
 */
export async function listMyReports(req: Request, res: Response): Promise<void> {
  res.json({
    reports: await hazardReportService.getReportsByReporter(req.user!.sub),
  });
}

/**
 * GET /api/reports/:reportId
 */
export async function getReport(req: Request, res: Response): Promise<void> {
  res.json({ report: await hazardReportService.getReport(param(req.params.reportId)) });
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}
