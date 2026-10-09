import { ApiError } from "../utils/apiError";
import { getHazardReportService } from "../services/dushani-hazardReportService";
import * as baseRepo from "../repositories/dushani-hazardReportRepository";
import { getDistrictBoundaryService } from "../services/dushani-districtBoundaryService";
import { getAuditLogger } from "../services/dushani-auditLoggerService";
import { ReportStatus, type HazardReport } from "../models/hazardReport";

jest.mock("../repositories/dushani-hazardReportRepository");
jest.mock("../services/dushani-districtBoundaryService", () => {
  const hasDistrict = jest.fn(() => true);
  return { getDistrictBoundaryService: () => ({ hasDistrict }) };
});
jest.mock("../services/dushani-auditLoggerService", () => {
  const log = jest.fn();
  return { getAuditLogger: () => ({ log }) };
});

const findReportByPublicId = baseRepo.findReportByPublicId as jest.Mock;
const updateVerification = baseRepo.updateVerification as jest.Mock;
const insertNotifications = baseRepo.insertNotifications as jest.Mock;
const findVerificationRecipients = baseRepo.findVerificationRecipients as jest.Mock;
const auditLog = (getAuditLogger() as unknown as { log: jest.Mock }).log;
void (getDistrictBoundaryService() as unknown as { hasDistrict: jest.Mock });

function makeReport(overrides: Partial<HazardReport> = {}): HazardReport {
  const now = new Date("2026-10-01T04:30:00.000Z");

  return {
    id: "11111111-1111-1111-1111-111111111111",
    reportId: "RPT-LXK2A1-0007",
    reporterId: "citizen-9",
    reporterName: "Nimal Perera",
    hazardType: "FLOOD",
    severityLevel: "HIGH",
    locationDistrict: "Colombo",
    description: "Knee-deep water across the lane since last night.",
    status: ReportStatus.PENDING_VERIFICATION,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const service = getHazardReportService();

beforeEach(() => {
  findVerificationRecipients.mockResolvedValue(["officer-1", "officer-2"]);
});

describe("HazardReportService.verifyReport (the verification gate)", () => {
  it("returns 404 for a report reference that does not exist", async () => {
    findReportByPublicId.mockResolvedValue(null);

    await expect(
      service.verifyReport("RPT-MISSING-0001", "officer-1", {
        status: ReportStatus.VERIFIED,
      })
    ).rejects.toMatchObject({ status: 404, message: "Hazard report not found." });
  });

  it("refuses a second decision on a report that was already verified", async () => {
    findReportByPublicId.mockResolvedValue(
      makeReport({ status: ReportStatus.VERIFIED })
    );

    await expect(
      service.verifyReport("RPT-LXK2A1-0007", "officer-1", {
        status: ReportStatus.REJECTED,
        verificationNotes: "Changing my mind.",
      })
    ).rejects.toMatchObject({
      status: 409,
      message: "This report was already verified.",
    });

    expect(updateVerification).not.toHaveBeenCalled();
  });

  it("surfaces a conflict when the report changed while the officer was reviewing", async () => {
    findReportByPublicId.mockResolvedValue(makeReport());
    updateVerification.mockResolvedValue(null);

    await expect(
      service.verifyReport("RPT-LXK2A1-0007", "officer-1", {
        status: ReportStatus.VERIFIED,
      })
    ).rejects.toMatchObject({
      status: 409,
      message: "The report changed while you were reviewing it.",
    });
  });

  it("verifies a pending report, informs the reporter and the other officers, and audits the decision", async () => {
    findReportByPublicId.mockResolvedValue(makeReport());
    const verified = makeReport({
      status: ReportStatus.VERIFIED,
      verifiedBy: "officer-1",
      verifiedAt: new Date("2026-10-01T05:00:00.000Z"),
    });
    updateVerification.mockResolvedValue(verified);

    const report = await service.verifyReport("RPT-LXK2A1-0007", "officer-1", {
      status: ReportStatus.VERIFIED,
      verificationNotes: "Ground team confirmed the flooding.",
    });

    expect(report.status).toBe(ReportStatus.VERIFIED);
    expect(updateVerification).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "officer-1",
      ReportStatus.VERIFIED,
      "Ground team confirmed the flooding."
    );

    const notifications = insertNotifications.mock.calls[0][0];
    const recipients = notifications.map(
      (entry: { recipientId: string }) => entry.recipientId
    );

    expect(recipients).toHaveLength(2);
    expect(recipients).toContain("citizen-9");
    expect(recipients).toContain("officer-2");
    expect(recipients).not.toContain("officer-1");

    expect(notifications[0].type).toBe("REPORT_VERIFIED");
    expect(notifications[0].title).toBe("Verified: FLOOD in Colombo");

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        officerId: "officer-1",
        action: "REVIEWED_REPORT",
        entryPoint: "VERIFY_REPORT",
        details: { reportId: "RPT-LXK2A1-0007", status: "VERIFIED" },
      })
    );
  });

  it("rejects a pending report and carries the officer's reason to the citizen", async () => {
    findReportByPublicId.mockResolvedValue(makeReport());
    const rejected = makeReport({
      status: ReportStatus.REJECTED,
      verificationNotes: "Photo shows a different location.",
    });
    updateVerification.mockResolvedValue(rejected);

    const report = await service.verifyReport("RPT-LXK2A1-0007", "officer-2", {
      status: ReportStatus.REJECTED,
      verificationNotes: "Photo shows a different location.",
    });

    expect(report.status).toBe(ReportStatus.REJECTED);

    const notifications = insertNotifications.mock.calls[0][0];

    expect(notifications[0].type).toBe("REPORT_REJECTED");
    expect(notifications[0].title).toBe("Rejected: FLOOD in Colombo");
    expect(notifications[0].message).toContain("Photo shows a different location.");
  });

  it("still hears back a report with no known reporter account", async () => {
    findReportByPublicId.mockResolvedValue(makeReport({ reporterId: undefined }));
    updateVerification.mockResolvedValue(
      makeReport({ status: ReportStatus.VERIFIED, reporterId: undefined })
    );

    await service.verifyReport("RPT-LXK2A1-0007", "officer-1", {
      status: ReportStatus.VERIFIED,
    });

    const notifications = insertNotifications.mock.calls[0][0];
    const recipients = notifications.map(
      (entry: { recipientId: string }) => entry.recipientId
    );

    expect(recipients.sort()).toEqual(["officer-2"]);
  });
});

describe("HazardReportService.getReport", () => {
  it("returns 404 for an unknown public reference", async () => {
    findReportByPublicId.mockResolvedValue(null);

    try {
      await service.getReport("RPT-MISSING-0001");
      throw new Error("should not reach here");
    } catch (error) {
      expect((error as ApiError).status).toBe(404);
    }
  });

  it("returns the report for a known public reference", async () => {
    const stored = makeReport();
    findReportByPublicId.mockResolvedValue(stored);

    await expect(service.getReport("RPT-LXK2A1-0007")).resolves.toBe(stored);
  });
});
