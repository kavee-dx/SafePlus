import { ApiError } from "../utils/apiError";
import { getDistrictBoundaryService } from "./dushani-districtBoundaryService";
import { getAuditLogger } from "./dushani-auditLoggerService";
import { findVerificationRecipients } from "../repositories/dushani-hazardReportRepository";
import {
  createDetailedReport,
  findDetailById,
  findDetailByPublicId,
  insertReportNotifications,
  listExtended,
  listExtendedByReporter,
  requestMoreInfo as requestMoreInfoRow,
  resubmitReport,
} from "../repositories/amasha-reportRepository";
import {
  ADDITIONAL_INFO_REQUIRED,
  type DetailedReportInput,
  type ExtendedHazardReport,
} from "../models/amasha-hazardReportExt";

const districts = getDistrictBoundaryService();
const auditLogger = getAuditLogger();

function generateReportId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");

  return `RPT-${timestamp}-${random}`;
}

function assertDistrict(district: string): void {
  if (!districts.hasDistrict(district)) {
    throw new ApiError(400, "Choose one of Sri Lanka's 25 districts.", {
      locationDistrict: "Unknown district.",
    });
  }
}

/**
 * UC-02 ground-report lifecycle on top of the existing hazard_reports tables.
 * Verification itself is still handled by the dushani HazardReportService so
 * there is a single gate that unlocks warning creation.
 */
export class ReportExtensionService {
  /** Main flow + A1 (evidence optional) + E1 resubmission of a stored draft. */
  async submit(reporterId: string, data: DetailedReportInput): Promise<ExtendedHazardReport> {
    assertDistrict(data.locationDistrict);

    const report = await createDetailedReport(
      generateReportId(),
      reporterId,
      data
    );

    await this.notifyOfficersSubmitted(report);

    return report;
  }

  async detailForOfficer(id: string): Promise<ExtendedHazardReport> {
    const report = await this.lookup(id);

    if (!report) {
      throw new ApiError(404, "Hazard report not found.");
    }

    return report;
  }

  async detailForReporter(id: string, reporterId: string): Promise<ExtendedHazardReport> {
    const report = await this.lookup(id);

    if (!report || report.reporterId !== reporterId) {
      throw new ApiError(404, "Hazard report not found.");
    }

    return report;
  }

  private async lookup(id: string): Promise<ExtendedHazardReport | null> {
    return (await findDetailById(id)) ?? (await findDetailByPublicId(id));
  }

  /** A2: officer asks the citizen for more; report leaves the pending queue. */
  async requestMoreInfo(
    id: string,
    officerId: string,
    reason: string
  ): Promise<ExtendedHazardReport> {
    const existing = await findDetailById(id);

    if (!existing) {
      throw new ApiError(404, "Hazard report not found.");
    }

    if (existing.status !== "PENDING_VERIFICATION") {
      throw new ApiError(
        409,
        `Only a report awaiting verification can be sent back for more information (this one is ${existing.status}).`
      );
    }

    const updated = await requestMoreInfoRow(id, officerId, reason);

    if (!updated) {
      throw new ApiError(409, "The report changed while you were reviewing it.");
    }

    const recipients = new Set<string>();

    if (updated.reporterId) {
      recipients.add(updated.reporterId);
    }

    await insertReportNotifications(
      [...recipients].map((recipientId) => ({
        recipientId,
        type: "REPORT_INFO_REQUESTED",
        title: `More information needed: ${updated.hazardType} in ${updated.locationDistrict}`,
        message: `${updated.reportId} — ${reason}`,
        relatedReportId: updated.id,
      }))
    );

    auditLogger.log({
      warningId: null,
      officerId,
      action: "REVIEWED_REPORT",
      entryPoint: "REQUEST_REPORT_INFO",
      details: { reportId: updated.reportId, reason },
    });

    return updated;
  }

  /** A2: citizen answers, report returns to PENDING_VERIFICATION. */
  async resubmit(
    id: string,
    reporterId: string,
    data: DetailedReportInput
  ): Promise<ExtendedHazardReport> {
    const existing = await findDetailById(id);

    if (!existing || existing.reporterId !== reporterId) {
      throw new ApiError(404, "Hazard report not found.");
    }

    if (existing.status !== ADDITIONAL_INFO_REQUIRED) {
      throw new ApiError(
        409,
        "Only a report awaiting additional information can be resubmitted."
      );
    }

    assertDistrict(data.locationDistrict);

    const updated = await resubmitReport(id, data);

    if (!updated) {
      throw new ApiError(409, "The report changed while you were updating it.");
    }

    await this.notifyOfficersSubmitted(updated, true);

    return updated;
  }

  listPending(district?: string): Promise<ExtendedHazardReport[]> {
    return listExtended("PENDING_VERIFICATION", { district });
  }

  listInfoRequired(district?: string): Promise<ExtendedHazardReport[]> {
    return listExtended(ADDITIONAL_INFO_REQUIRED as ExtendedHazardReport["status"], {
      district,
    });
  }

  listVerified(): Promise<ExtendedHazardReport[]> {
    return listExtended("VERIFIED");
  }

  listRejected(): Promise<ExtendedHazardReport[]> {
    return listExtended("REJECTED");
  }

  listMine(reporterId: string): Promise<ExtendedHazardReport[]> {
    return listExtendedByReporter(reporterId);
  }

  private async notifyOfficersSubmitted(
    report: ExtendedHazardReport,
    resubmitted = false
  ): Promise<void> {
    const officers = await findVerificationRecipients(report.locationDistrict);

    await insertReportNotifications(
      officers.map((recipientId) => ({
        recipientId,
        type: "REPORT_SUBMITTED",
        title: `${resubmitted ? "Updated" : "New"} ${report.severityLevel.toLowerCase()} ${report.hazardType.toLowerCase()} report in ${report.locationDistrict}`,
        message: `${report.reporterName ?? "A citizen"} reported ${report.description.slice(0, 140)}`,
        relatedReportId: report.id,
      }))
    );
  }
}

let instance: ReportExtensionService | null = null;

export function getReportExtensionService(): ReportExtensionService {
  if (!instance) {
    instance = new ReportExtensionService();
  }

  return instance;
}
