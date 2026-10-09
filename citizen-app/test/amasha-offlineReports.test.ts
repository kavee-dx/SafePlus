import { AlertApiError } from "../src/services/dushani-alertApi";
import { submitDetailedReport } from "../src/services/amasha-reportApi";
import { isNetworkAvailable } from "../src/services/amasha-network";
import {
  deleteSecureDraft,
  listSecureDrafts,
} from "../src/services/amasha-secureReportStore";
import {
  isUnreachable,
  syncOfflineReports,
  type SyncResult,
} from "../src/services/amasha-offlineReports";
import type { DetailedReportPayload } from "../src/services/amasha-reportApi";

jest.mock("../src/services/amasha-reportApi");
jest.mock("../src/services/amasha-network");
jest.mock("../src/services/amasha-secureReportStore", () => ({
  listSecureDrafts: jest.fn(),
  insertSecureDraft: jest.fn(),
  deleteSecureDraft: jest.fn(),
  PENDING_SYNCHRONIZATION: "PENDING_SYNCHRONIZATION",
}));

const submitDetailedReportMock = submitDetailedReport as jest.Mock;
const isNetworkAvailableMock = isNetworkAvailable as jest.Mock;
const listSecureDraftsMock = listSecureDrafts as jest.Mock;
const deleteSecureDraftMock = deleteSecureDraft as jest.Mock;

const storedPayload: DetailedReportPayload = {
  hazardType: "LANDSLIDE",
  severityLevel: "CRITICAL",
  locationDistrict: "Kegalle",
  description: "Cracks widening on the slope behind the school.",
  observedAt: "2026-10-01T03:00:00.000Z",
  immediateDanger: true,
};

function makeDraft(id: string) {
  return {
    id,
    userKey: "user-1",
    status: "PENDING_SYNCHRONIZATION",
    savedAt: "2026-10-01T04:30:00.000Z",
    payload: { ...storedPayload },
  };
}

beforeEach(() => {
  isNetworkAvailableMock.mockResolvedValue(true);
});

describe("isUnreachable", () => {
  it("recognises a dropped connection, but not a server rejection", () => {
    expect(isUnreachable(new AlertApiError("Cannot reach SafePlus.", null))).toBe(true);

    expect(isUnreachable(new AlertApiError("Fix the fields.", 400))).toBe(false);
    expect(isUnreachable(new Error("ordinary failure"))).toBe(false);
  });
});

describe("syncOfflineReports", () => {
  it("does nothing when the citizen has no saved drafts", async () => {
    listSecureDraftsMock.mockResolvedValue([]);

    const result: SyncResult = await syncOfflineReports("token-abc", "user-1");

    expect(result).toEqual({ sent: 0, remaining: 0 });
    expect(submitDetailedReportMock).not.toHaveBeenCalled();
  });

  it("keeps every draft queued while the network is still down", async () => {
    listSecureDraftsMock.mockResolvedValue([makeDraft("OFFLINE-1"), makeDraft("OFFLINE-2")]);
    isNetworkAvailableMock.mockResolvedValue(false);

    const result = await syncOfflineReports("token-abc", "user-1");

    expect(result).toEqual({
      sent: 0,
      remaining: 2,
      lastError: "Network is still unavailable. Reports stay Pending Synchronization.",
    });
    expect(submitDetailedReportMock).not.toHaveBeenCalled();
    expect(deleteSecureDraftMock).not.toHaveBeenCalled();
  });

  it("sends each saved draft, clears it on success and reports how many went out", async () => {
    listSecureDraftsMock
      .mockResolvedValueOnce([makeDraft("OFFLINE-1"), makeDraft("OFFLINE-2")])
      .mockResolvedValueOnce([]);
    submitDetailedReportMock.mockResolvedValue({ id: "rpt-1" });

    const result = await syncOfflineReports("token-abc", "user-1");

    expect(result).toEqual({ sent: 2, remaining: 0 });
    expect(submitDetailedReportMock).toHaveBeenCalledTimes(2);
    expect(submitDetailedReportMock).toHaveBeenNthCalledWith(1, "token-abc", storedPayload);
    expect(deleteSecureDraftMock).toHaveBeenCalledWith("user-1", "OFFLINE-1");
    expect(deleteSecureDraftMock).toHaveBeenCalledWith("user-1", "OFFLINE-2");
  });

  it("stops at the first dropped connection and keeps the unsent drafts", async () => {
    listSecureDraftsMock
      .mockResolvedValueOnce([makeDraft("OFFLINE-1"), makeDraft("OFFLINE-2")])
      .mockResolvedValueOnce([makeDraft("OFFLINE-2")]);
    submitDetailedReportMock.mockRejectedValueOnce(
      new AlertApiError("Cannot reach SafePlus.", null)
    );

    const result = await syncOfflineReports("token-abc", "user-1");

    expect(result).toEqual({
      sent: 0,
      remaining: 1,
      lastError: "Cannot reach SafePlus.",
    });
    expect(submitDetailedReportMock).toHaveBeenCalledTimes(1);
    expect(deleteSecureDraftMock).not.toHaveBeenCalled();
  });

  it("continues past a rejected draft, because a validation failure is not a network failure", async () => {
    listSecureDraftsMock
      .mockResolvedValueOnce([makeDraft("OFFLINE-1"), makeDraft("OFFLINE-2")])
      .mockResolvedValueOnce([makeDraft("OFFLINE-1")]);
    submitDetailedReportMock
      .mockRejectedValueOnce(
        new AlertApiError("Fix the highlighted fields before submitting.", 400, {
          description: "Say what you can see.",
        })
      )
      .mockResolvedValueOnce({ id: "rpt-2" });

    const result = await syncOfflineReports("token-abc", "user-1");

    expect(result).toEqual({
      sent: 1,
      remaining: 1,
      lastError: "Fix the highlighted fields before submitting.",
    });
    expect(submitDetailedReportMock).toHaveBeenCalledTimes(2);
  });

  it("reports a plain wording when a draft fails with an unexpected error", async () => {
    listSecureDraftsMock
      .mockResolvedValueOnce([makeDraft("OFFLINE-1")])
      .mockResolvedValueOnce([makeDraft("OFFLINE-1")]);
    submitDetailedReportMock.mockRejectedValueOnce(new Error("socket hang up"));

    const result = await syncOfflineReports("token-abc", "user-1");

    expect(result.lastError).toBe("A saved report could not be sent.");
  });
});
