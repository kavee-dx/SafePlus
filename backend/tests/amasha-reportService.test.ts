import { ApiError } from "../utils/apiError";
import { getReportExtensionService } from "../services/amasha-reportService";
import * as extRepo from "../repositories/amasha-reportRepository";
import * as baseRepo from "../repositories/dushani-hazardReportRepository";
import { getDistrictBoundaryService } from "../services/dushani-districtBoundaryService";
import { getAuditLogger } from "../services/dushani-auditLoggerService";
import type { DetailedReportInput, ExtendedHazardReport } from "../models/amasha-hazardReportExt";
import { ADDITIONAL_INFO_REQUIRED } from "../models/amasha-hazardReportExt";

jest.mock("../repositories/amasha-reportRepository");
jest.mock("../repositories/dushani-hazardReportRepository");
jest.mock("../services/dushani-districtBoundaryService", () => {
  const hasDistrict = jest.fn(() => true);
  return { getDistrictBoundaryService: () => ({ hasDistrict }) };
});
jest.mock("../services/dushani-auditLoggerService", () => {
  const log = jest.fn();
  return { getAuditLogger: () => ({ log }) };
});

const hasDistrict = (getDistrictBoundaryService() as unknown as { hasDistrict: jest.Mock })
  .hasDistrict;
const auditLog = (getAuditLogger() as unknown as { log: jest.Mock }).log;

const createDetailedReport = extRepo.createDetailedReport as jest.Mock;
const findDetailById = extRepo.findDetailById as jest.Mock;
const findDetailByPublicId = extRepo.findDetailByPublicId as jest.Mock;
const requestMoreInfoRow = extRepo.requestMoreInfo as jest.Mock;
const resubmitReport = extRepo.resubmitReport as jest.Mock;
const insertReportNotifications = extRepo.insertReportNotifications as jest.Mock;
const findVerificationRecipients = baseRepo.findVerificationRecipients as jest.Mock;

function makeExtReport(overrides: Partial<ExtendedHazardReport> = {}): ExtendedHazardReport {
  const now = new Date("2026-10-01T04:30:00.000Z");

  return {
    id: "22222222-2222-2222-2222-222222222222",
    reportId: "RPT-LXK2A1-0042",
    reporterId: "citizen-9",
    reporterName: "Nimal Perera",
    hazardType: "FLOOD",
    severityLevel: "HIGH",
    locationDistrict: "Colombo",
    description: "Knee-deep water across the lane since last night.",
    immediateDanger: false,
    status: "PENDING_VERIFICATION",
    attachments: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const validInput: DetailedReportInput = {
  hazardType: "FLOOD",
  severityLevel: "HIGH",
  locationDistrict: "Colombo",
  description: "Knee-deep water across the lane since last night.",
  observedAt: "2026-10-01T04:00:00.000Z",
};

const service = getReportExtensionService();

beforeEach(() => {
  hasDistrict.mockImplementation(() => true);
  findVerificationRecipients.mockResolvedValue(["officer-1"]);
});

describe("ReportExtensionService.submit", () => {
  it("rejects a district outside Sri Lanka's 25 districts", async () => {
    hasDistrict.mockImplementation(() => false);

    try {
      await service.submit("citizen-9", { ...validInput, locationDistrict: "Wonderland" });
      throw new Error("should not reach here");
    } catch (error) {
      const apiError = error as ApiError;

      expect(apiError.status).toBe(400);
      expect(apiError.fieldErrors?.locationDistrict).toBe("Unknown district.");
    }

    expect(createDetailedReport).not.toHaveBeenCalled();
  });

  it("persists the report under a fresh RPT reference and alerts the district officers", async () => {
    const stored = makeExtReport();
    createDetailedReport.mockResolvedValue(stored);

    const report = await service.submit("citizen-9", validInput);

    expect(report).toBe(stored);

    const [reportId, reporterId, data] = createDetailedReport.mock.calls[0];

    expect(reportId).toMatch(/^RPT-[0-9A-Z]+-[0-9A-Z]{4}$/);
    expect(reporterId).toBe("citizen-9");
    expect(data).toBe(validInput);

    expect(findVerificationRecipients).toHaveBeenCalledWith("Colombo");
    expect(insertReportNotifications).toHaveBeenCalledTimes(1);

    const notifications = insertReportNotifications.mock.calls[0][0];

    expect(notifications.map((entry: { recipientId: string }) => entry.recipientId)).toEqual([
      "officer-1",
    ]);
    expect(notifications[0].type).toBe("REPORT_SUBMITTED");
    expect(notifications[0].title).toContain("high flood report in Colombo");
    expect(notifications[0].relatedReportId).toBe(stored.id);
  });
});

describe("ReportExtensionService detail lookup", () => {
  it("returns 404 when neither the internal id nor the public id resolves", async () => {
    findDetailById.mockResolvedValue(null);
    findDetailByPublicId.mockResolvedValue(null);

    await expect(service.detailForOfficer("nope")).rejects.toMatchObject({
      status: 404,
      message: "Hazard report not found.",
    });
  });

  it("falls back to the public RPT reference when the internal id misses", async () => {
    findDetailById.mockResolvedValue(null);
    findDetailByPublicId.mockResolvedValue(makeExtReport());

    const report = await service.detailForOfficer("RPT-LXK2A1-0042");

    expect(report.reportId).toBe("RPT-LXK2A1-0042");
  });

  it("hides another citizen's report behind a 404 and returns the owner's copy", async () => {
    findDetailById.mockResolvedValue(makeExtReport({ reporterId: "someone-else" }));

    await expect(
      service.detailForReporter("RPT-LXK2A1-0042", "citizen-9")
    ).rejects.toMatchObject({ status: 404 });

    findDetailById.mockResolvedValue(makeExtReport());

    const own = await service.detailForReporter("RPT-LXK2A1-0042", "citizen-9");

    expect(own.reporterId).toBe("citizen-9");
  });
});

describe("ReportExtensionService.requestMoreInfo", () => {
  it("returns 404 for an unknown report", async () => {
    findDetailById.mockResolvedValue(null);

    await expect(
      service.requestMoreInfo("nope", "officer-1", "Please add the nearest landmark.")
    ).rejects.toMatchObject({ status: 404 });
  });

  it("refuses to send back a report that already left the pending queue", async () => {
    findDetailById.mockResolvedValue(makeExtReport({ status: "VERIFIED" }));

    await expect(
      service.requestMoreInfo("RPT-LXK2A1-0042", "officer-1", "Please add the nearest landmark.")
    ).rejects.toMatchObject({
      status: 409,
      message:
        "Only a report awaiting verification can be sent back for more information (this one is VERIFIED).",
    });
  });

  it("surfaces a conflict when the report changed while the officer was reviewing", async () => {
    findDetailById.mockResolvedValue(makeExtReport());
    requestMoreInfoRow.mockResolvedValue(null);

    await expect(
      service.requestMoreInfo("RPT-LXK2A1-0042", "officer-1", "Please add the nearest landmark.")
    ).rejects.toMatchObject({
      status: 409,
      message: "The report changed while you were reviewing it.",
    });
  });

  it("notifies the reporter, records the audit trail and returns the updated report", async () => {
    findDetailById.mockResolvedValue(makeExtReport());
    const updated = makeExtReport({
      status: ADDITIONAL_INFO_REQUIRED as ExtendedHazardReport["status"],
      infoRequestReason: "Please add the nearest landmark.",
    });
    requestMoreInfoRow.mockResolvedValue(updated);

    const report = await service.requestMoreInfo(
      "RPT-LXK2A1-0042",
      "officer-1",
      "Please add the nearest landmark."
    );

    expect(report.status).toBe(ADDITIONAL_INFO_REQUIRED);
    expect(requestMoreInfoRow).toHaveBeenCalledWith(
      "RPT-LXK2A1-0042",
      "officer-1",
      "Please add the nearest landmark."
    );

    const notifications = insertReportNotifications.mock.calls[0][0];

    expect(notifications).toHaveLength(1);
    expect(notifications[0].recipientId).toBe("citizen-9");
    expect(notifications[0].type).toBe("REPORT_INFO_REQUESTED");
    expect(notifications[0].message).toContain("RPT-LXK2A1-0042");
    expect(notifications[0].relatedReportId).toBe(updated.id);

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        officerId: "officer-1",
        entryPoint: "REQUEST_REPORT_INFO",
        details: { reportId: "RPT-LXK2A1-0042", reason: "Please add the nearest landmark." },
      })
    );
  });
});

describe("ReportExtensionService.resubmit", () => {
  const resubmitInput: DetailedReportInput = {
    ...validInput,
    landmark: "Near the Kelani bridge",
  };

  it("returns 404 when the report is missing or belongs to someone else", async () => {
    findDetailById.mockResolvedValue(null);

    await expect(
      service.resubmit("nope", "citizen-9", resubmitInput)
    ).rejects.toMatchObject({ status: 404 });

    findDetailById.mockResolvedValue(makeExtReport({ reporterId: "someone-else" }));

    await expect(
      service.resubmit("RPT-LXK2A1-0042", "citizen-9", resubmitInput)
    ).rejects.toMatchObject({ status: 404 });
  });

  it("refuses a resubmit while the report is still awaiting its first verification", async () => {
    findDetailById.mockResolvedValue(makeExtReport({ status: "PENDING_VERIFICATION" }));

    await expect(
      service.resubmit("RPT-LXK2A1-0042", "citizen-9", resubmitInput)
    ).rejects.toMatchObject({
      status: 409,
      message: "Only a report awaiting additional information can be resubmitted.",
    });
  });

  it("re-validates the district on the way back up", async () => {
    findDetailById.mockResolvedValue(
      makeExtReport({ status: ADDITIONAL_INFO_REQUIRED as ExtendedHazardReport["status"] })
    );
    hasDistrict.mockImplementation(() => false);

    await expect(
      service.resubmit("RPT-LXK2A1-0042", "citizen-9", {
        ...resubmitInput,
        locationDistrict: "Atlantis",
      })
    ).rejects.toMatchObject({ status: 400, fieldErrors: { locationDistrict: "Unknown district." } });
  });

  it("surfaces a conflict when the report changed while the citizen was editing", async () => {
    findDetailById.mockResolvedValue(
      makeExtReport({ status: ADDITIONAL_INFO_REQUIRED as ExtendedHazardReport["status"] })
    );
    resubmitReport.mockResolvedValue(null);

    await expect(
      service.resubmit("RPT-LXK2A1-0042", "citizen-9", resubmitInput)
    ).rejects.toMatchObject({
      status: 409,
      message: "The report changed while you were updating it.",
    });
  });

  it("sends the report back to pending and marks the officer notification as an update", async () => {
    findDetailById.mockResolvedValue(
      makeExtReport({ status: ADDITIONAL_INFO_REQUIRED as ExtendedHazardReport["status"] })
    );
    const reopened = makeExtReport({ status: "PENDING_VERIFICATION" });
    resubmitReport.mockResolvedValue(reopened);

    const report = await service.resubmit("RPT-LXK2A1-0042", "citizen-9", resubmitInput);

    expect(report.status).toBe("PENDING_VERIFICATION");
    expect(resubmitReport).toHaveBeenCalledWith("RPT-LXK2A1-0042", resubmitInput);

    const notifications = insertReportNotifications.mock.calls[0][0];

    expect(notifications[0].type).toBe("REPORT_SUBMITTED");
    expect(notifications[0].title).toContain("Updated");
    expect(notifications[0].title).toContain("Colombo");
  });
});

describe("ReportExtensionService queue listings", () => {
  it("delegates each queue to the repository with the matching status", () => {
    const listExtended = extRepo.listExtended as jest.Mock;
    const listExtendedByReporter = extRepo.listExtendedByReporter as jest.Mock;

    service.listPending("Galle");
    service.listInfoRequired("Galle");
    service.listVerified();
    service.listRejected();
    service.listMine("citizen-9");

    expect(listExtended).toHaveBeenNthCalledWith(1, "PENDING_VERIFICATION", { district: "Galle" });
    expect(listExtended).toHaveBeenNthCalledWith(2, "ADDITIONAL_INFO_REQUIRED", {
      district: "Galle",
    });
    expect(listExtended).toHaveBeenNthCalledWith(3, "VERIFIED");
    expect(listExtended).toHaveBeenNthCalledWith(4, "REJECTED");
    expect(listExtendedByReporter).toHaveBeenCalledWith("citizen-9");
  });
});
