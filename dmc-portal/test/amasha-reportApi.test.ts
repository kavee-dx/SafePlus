import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";

import {
  fetchQueueInfoRequired,
  fetchQueuePending,
  fetchQueueRejected,
  fetchQueueReport,
  fetchQueueVerified,
  requestMoreInfo,
} from "../src/services/amasha-reportApi";
import { AlertApiError } from "../src/services/dushani-alertApi";
import { getStoredDmcToken } from "../src/services/dmc-authApi";

const reportApi = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  interceptors: { request: { use: vi.fn() } },
}));

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();

  return {
    ...actual,
    default: { ...actual.default, create: () => reportApi },
  };
});

vi.mock("../src/services/dmc-authApi", () => ({
  getStoredDmcToken: vi.fn(() => "officer-token"),
}));

// The module registers its auth interceptor at import time, and restoreMocks
// wipes that call record before each test — so grab the function once here.
const signWithStoredToken = reportApi.interceptors.request.use.mock.calls[0][0] as (
  config: Record<string, unknown>
) => Record<string, unknown>;

beforeEach(() => {
  reportApi.get.mockReset();
  reportApi.put.mockReset();
  vi.mocked(getStoredDmcToken).mockReturnValue("officer-token");
});

describe("queue listings", () => {
  it("loads the pending queue, optionally narrowed to one district", async () => {
    const reports = [{ id: "rpt-1", reportId: "RPT-A1-0001" }];

    reportApi.get.mockResolvedValue({ data: { reports } });

    await expect(fetchQueuePending()).resolves.toBe(reports);
    expect(reportApi.get).toHaveBeenCalledWith("/reports/queue/pending");

    await fetchQueuePending("Galle");
    expect(reportApi.get).toHaveBeenLastCalledWith("/reports/queue/pending?district=Galle");
  });

  it("encodes the district filter the same way the browser would", async () => {
    reportApi.get.mockResolvedValue({ data: { reports: [] } });

    await fetchQueuePending("North Central");

    expect(reportApi.get).toHaveBeenCalledWith(
      `/reports/queue/pending?district=${encodeURIComponent("North Central")}`
    );
  });

  it("walks the other three queues on their own paths", async () => {
    reportApi.get.mockResolvedValue({ data: { reports: [] } });

    await fetchQueueInfoRequired();
    await fetchQueueVerified();
    await fetchQueueRejected();

    expect(reportApi.get).toHaveBeenNthCalledWith(1, "/reports/queue/info-required");
    expect(reportApi.get).toHaveBeenNthCalledWith(2, "/reports/queue/verified");
    expect(reportApi.get).toHaveBeenNthCalledWith(3, "/reports/queue/rejected");
  });
});

describe("fetchQueueReport", () => {
  it("loads one report by its internal uuid and hands back the report", async () => {
    const report = { id: "uuid-9", reportId: "RPT-A1-0009" };

    reportApi.get.mockResolvedValue({ data: { report } });

    await expect(fetchQueueReport("uuid 9/x")).resolves.toBe(report);

    expect(reportApi.get).toHaveBeenCalledWith(
      `/reports/queue/${encodeURIComponent("uuid 9/x")}`
    );
  });
});

describe("requestMoreInfo", () => {
  it("puts the officer's reason to the request-info endpoint", async () => {
    reportApi.put.mockResolvedValue({ data: { report: { id: "uuid-1" } } });

    await requestMoreInfo("uuid-1", "Please add the nearest landmark.");

    expect(reportApi.put).toHaveBeenCalledWith("/reports/queue/uuid-1/request-info", {
      reason: "Please add the nearest landmark.",
    });
  });
});

describe("error unwrapping", () => {
  it("raises an AlertApiError carrying the server's status and message", async () => {
    const failure = new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 404,
      data: { message: "Hazard report not found." },
    } as never);

    reportApi.get.mockRejectedValue(failure);

    try {
      await fetchQueueReport("uuid-404");
      throw new Error("should not reach here");
    } catch (error) {
      expect(error).toBeInstanceOf(AlertApiError);
      expect((error as AlertApiError).status).toBe(404);
      expect((error as AlertApiError).message).toBe("Hazard report not found.");
    }
  });

  it("falls back to a generic 500 message when the body says nothing useful", async () => {
    const failure = new AxiosError("Request failed", "ECONNABORTED", undefined, undefined, {
      status: undefined,
      data: undefined,
    } as never);

    reportApi.put.mockRejectedValue(failure);

    await expect(requestMoreInfo("uuid-1", "reason")).rejects.toMatchObject({
      name: "AlertApiError",
      status: 500,
      message: "The server could not complete that action.",
    });
  });

  it("rethrows errors that are not axios failures at all", async () => {
    const failure = new Error("callback cancelled");

    reportApi.get.mockRejectedValue(failure);

    await expect(fetchQueuePending()).rejects.toBe(failure);
  });
});

describe("auth interceptor", () => {
  it("signs every request with the stored officer token", () => {
    const result = signWithStoredToken({ headers: {} as Record<string, unknown> });

    expect(result.headers).toEqual({ Authorization: "Bearer officer-token" });
  });

  it("leaves the request unsigned when no officer is logged in", () => {
    vi.mocked(getStoredDmcToken).mockReturnValue(null);

    const result = signWithStoredToken({ headers: {} as Record<string, unknown> });

    expect(result.headers).toEqual({});
  });
});
