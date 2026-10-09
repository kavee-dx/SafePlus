import axios from "axios";
import {
  fetchMyReportDetail,
  fetchMyReportNotifications,
  fetchMyReportsExtended,
  markMyNotificationRead,
  resubmitReport,
  resolveDistrictName,
  submitDetailedReport,
  type DetailedReportPayload,
} from "../src/services/amasha-reportApi";
import { AlertApiError } from "../src/services/dushani-alertApi";

jest.mock("axios");

const api = axios as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
  isAxiosError: jest.Mock;
};

function axiosError(status: number | undefined, data?: unknown) {
  const error: unknown = {
    isAxiosError: true,
    message: "Request failed",
    response: status === undefined ? undefined : { status, data },
  };

  return error;
}

const payload: DetailedReportPayload = {
  hazardType: "FLOOD",
  severityLevel: "HIGH",
  locationDistrict: "Colombo",
  description: "Water is knee-deep and rising near the temple lane.",
  observedAt: "2026-10-01T03:00:00.000Z",
  immediateDanger: false,
};

beforeEach(() => {
  api.isAxiosError.mockImplementation(
    (value: unknown) =>
      typeof value === "object" &&
      value !== null &&
      (value as { isAxiosError?: boolean }).isAxiosError === true
  );
});

describe("submitDetailedReport", () => {
  it("posts the ground report to the detailed endpoint with the citizen's token", async () => {
    const saved = { id: "rpt-1", reportId: "RPT-ABC-0001" };

    api.post.mockResolvedValue({ data: { report: saved } });

    await expect(submitDetailedReport("token-abc", payload)).resolves.toBe(saved);

    expect(api.post).toHaveBeenCalledWith(
      expect.stringContaining("/reports/detailed"),
      payload,
      expect.objectContaining({
        timeout: 60000,
        maxBodyLength: Infinity,
        headers: expect.objectContaining({
          Authorization: "Bearer token-abc",
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("keeps the server's per-field complaints attached to the error", async () => {
    api.post.mockRejectedValue(
      axiosError(400, {
        message: "Fix the highlighted fields before submitting.",
        errors: { description: "Say what you can see." },
      })
    );

    try {
      await submitDetailedReport("token-abc", payload);
      throw new Error("should not reach here");
    } catch (error) {
      expect(error).toBeInstanceOf(AlertApiError);
      expect((error as AlertApiError).status).toBe(400);
      expect((error as AlertApiError).message).toBe(
        "Fix the highlighted fields before submitting."
      );
      expect((error as AlertApiError).fieldErrors).toEqual({
        description: "Say what you can see.",
      });
    }
  });

  it("marks a dropped connection as unreachable so the app can queue the draft offline", async () => {
    api.post.mockRejectedValue(axiosError(undefined));

    try {
      await submitDetailedReport("token-abc", payload);
      throw new Error("should not reach here");
    } catch (error) {
      expect(error).toBeInstanceOf(AlertApiError);
      expect((error as AlertApiError).status).toBeNull();
      expect((error as AlertApiError).message).toBe(
        "Cannot reach SafePlus. Check your connection and try again."
      );
    }
  });
});

describe("resubmitReport", () => {
  it("puts the corrected report back to its own resubmit endpoint", async () => {
    api.put.mockResolvedValue({ data: { report: { id: "rpt-2" } } });

    await resubmitReport("token-abc", "rpt-2", payload);

    expect(api.put).toHaveBeenCalledWith(
      expect.stringContaining("/reports/mine/rpt-2/resubmit"),
      payload,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
      })
    );
  });
});

describe("fetchMyReportsExtended and fetchMyReportDetail", () => {
  it("lists the citizen's reports from the extended mine endpoint", async () => {
    api.get.mockResolvedValue({ data: { reports: [{ id: "rpt-2" }] } });

    await expect(fetchMyReportsExtended("token-abc")).resolves.toEqual([
      { id: "rpt-2" },
    ]);

    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining("/reports/mine/list"),
      expect.anything()
    );
  });

  it("encodes the report id when loading one report's detail", async () => {
    api.get.mockResolvedValue({ data: { report: { id: "rpt 9" } } });

    await fetchMyReportDetail("token-abc", "rpt 9");

    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining(`/reports/mine/${encodeURIComponent("rpt 9")}`),
      expect.anything()
    );
  });

  it("passes server failures through as AlertApiError", async () => {
    api.get.mockRejectedValue(axiosError(404, { message: "Hazard report not found." }));

    await expect(fetchMyReportDetail("token-abc", "rpt-1")).rejects.toMatchObject({
      name: "AlertApiError",
      status: 404,
      message: "Hazard report not found.",
    });
  });
});

describe("notification endpoints", () => {
  it("returns the inbox payload untouched", async () => {
    const data = {
      notifications: [{ id: "n-1", type: "REPORT_VERIFIED" }],
      unreadCount: 1,
    };

    api.get.mockResolvedValue({ data });

    await expect(fetchMyReportNotifications("token-abc")).resolves.toBe(data);
  });

  it("marks a notification read through its own endpoint", async () => {
    api.put.mockResolvedValue({ data: {} });

    await markMyNotificationRead("token-abc", "n-1");

    expect(api.put).toHaveBeenCalledWith(
      expect.stringContaining("/notifications/n-1/read"),
      {},
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
      })
    );
  });
});

describe("resolveDistrictName", () => {
  it("resolves coordinates to the district the map should show", async () => {
    api.post.mockResolvedValue({ data: { district: "Colombo" } });

    await expect(resolveDistrictName(6.93, 79.86)).resolves.toBe("Colombo");

    expect(api.post).toHaveBeenCalledWith(
      expect.stringContaining("/geo/resolve"),
      { lat: 6.93, lng: 79.86 },
      expect.objectContaining({ timeout: 10000 })
    );
  });

  it("gives up quietly instead of blocking the wizard on a geo failure", async () => {
    api.post.mockRejectedValue(axiosError(500, { message: "boom" }));

    await expect(resolveDistrictName(6.93, 79.86)).resolves.toBeNull();
  });
});
