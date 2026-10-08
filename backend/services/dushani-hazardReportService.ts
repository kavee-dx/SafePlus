import {
  NotificationType,
  ReportStatus,
  type CreateReportRequest,
  type HazardReport,
  type VerifyReportRequest,
} from "../models/hazardReport";
import { ApiError } from "../utils/apiError";
import { getDistrictBoundaryService } from "./dushani-districtBoundaryService";
import {
  findReportByPublicId,
  findVerificationRecipients,
  insertNotifications,
  insertReport,
  listReports,
  listReportsByReporter,
  markNotificationRead,
  countUnreadNotifications,
  listNotifications,
  updateVerification,
} from "../repositories/dushani-hazardReportRepository";
import { getAuditLogger } from "./dushani-auditLoggerService";

const districts = getDistrictBoundaryService();
const auditLogger = getAuditLogger();

/**
 * Hazard reports are the precondition of the whole use case: nothing can be
 * broadcast until an officer has verified a ground report.
 */
export class HazardReportService {
  async createReport(
    reporterId: string,
    data: CreateReportRequest
  ): Promise<HazardReport> {
    if (!districts.hasDistrict(data.locationDistrict)) {
      throw new ApiError(
        400,
        "Choose one of Sri Lanka's 25 districts.",
        { locationDistrict: "Unknown district." }
      );
    }

    const report = await insertReport(
      generateReportId(),
      reporterId,
      data
    );

    const officers = await findVerificationRecipients(report.locationDistrict);

    await insertNotifications(
      officers.map((recipientId) => ({
        recipientId,
        type: NotificationType.REPORT_SUBMITTED,
        title: `New ${report.severityLevel.toLowerCase()} ${report.hazardType.toLowerCase()} report in ${report.locationDistrict}`,
        message: `${report.reporterName ?? "A citizen"} reported ${report.description.slice(0, 140)}`,
        relatedReportId: report.id,
      }))
    );

    return report;
  }

  async verifyReport(
    publicReportId: string,
    verifierId: string,
    data: VerifyReportRequest
  ): Promise<HazardReport> {
    const existing = await findReportByPublicId(publicReportId);

    if (!existing) {
      throw new ApiError(404, "Hazard report not found.");
    }

    if (existing.status !== ReportStatus.PENDING_VERIFICATION) {
      throw new ApiError(
        409,
        `This report was already ${existing.status.toLowerCase()}.`
      );
    }

    const report = await updateVerification(
      existing.id,
      verifierId,
      data.status,
      data.verificationNotes
    );

    if (!report) {
      throw new ApiError(409, "The report changed while you were reviewing it.");
    }

    const recipients = await this.verificationRecipients(report, verifierId);

    await insertNotifications(
      recipients.map((recipientId) => ({
        recipientId,
        type:
          report.status === ReportStatus.VERIFIED
            ? NotificationType.REPORT_VERIFIED
            : NotificationType.REPORT_REJECTED,
        title:
          report.status === ReportStatus.VERIFIED
            ? `Verified: ${report.hazardType} in ${report.locationDistrict}`
            : `Rejected: ${report.hazardType} in ${report.locationDistrict}`,
        message:
          report.status === ReportStatus.VERIFIED
            ? `${report.reportId} passed ground verification and is ready for a warning.`
            : `${report.reportId} was not verified. ${report.verificationNotes ?? ""}`.trim(),
        relatedReportId: report.id,
      }))
    );

    auditLogger.log({
      warningId: null,
      officerId: verifierId,
      action: "REVIEWED_REPORT",
      entryPoint: "VERIFY_REPORT",
      details: { reportId: report.reportId, status: report.status },
    });

    return report;
  }

  /**
   * The reporter always hears back; officers hearing about a verified report
   * are the ones who can raise the warning, minus whoever just decided it.
   */
  private async verificationRecipients(
    report: HazardReport,
    verifierId: string
  ): Promise<string[]> {
    const officers = await findVerificationRecipients(report.locationDistrict);
    const recipients = new Set(officers.filter((id) => id !== verifierId));

    if (report.reporterId) {
      recipients.add(report.reporterId);
    }

    return [...recipients];
  }

  async listPendingReports(district?: string): Promise<HazardReport[]> {
    return listReports(ReportStatus.PENDING_VERIFICATION, { district });
  }

  /**
   * Step 1 of the wizard: only verified reports can seed a warning.
   */
  async listVerifiedReports(): Promise<HazardReport[]> {
    return listReports(ReportStatus.VERIFIED);
  }

  async getReport(publicReportId: string): Promise<HazardReport> {
    const report = await findReportByPublicId(publicReportId);

    if (!report) {
      throw new ApiError(404, "Hazard report not found.");
    }

    return report;
  }

  async getReportsByReporter(reporterId: string): Promise<HazardReport[]> {
    return listReportsByReporter(reporterId);
  }

  async getNotifications(userId: string): Promise<{
    items: Awaited<ReturnType<typeof listNotifications>>;
    unreadCount: number;
  }> {
    const [items, unreadCount] = await Promise.all([
      listNotifications(userId),
      countUnreadNotifications(userId),
    ]);

    return { items, unreadCount };
  }

  async markNotificationAsRead(
    notificationId: string,
    userId: string
  ): Promise<void> {
    const updated = await markNotificationRead(notificationId, userId);

    if (!updated) {
      throw new ApiError(404, "Notification not found or already read.");
    }
  }
}

function generateReportId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");

  return `RPT-${timestamp}-${random}`;
}

let hazardReportServiceInstance: HazardReportService | null = null;

export function getHazardReportService(): HazardReportService {
  if (!hazardReportServiceInstance) {
    hazardReportServiceInstance = new HazardReportService();
  }

  return hazardReportServiceInstance;
}
