import {
  AlertApiError,
  fetchAlertInbox,
  fetchDistrictNames,
  markAlertRead,
  saveAlertTarget,
  submitHazardReport,
} from "./dushani-alertApi";
import axios from "axios";

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

beforeEach(() => {
  api.isAxiosError.mockImplementation(
    (value: unknown) =>
      typeof value === "object" &&
      value !== null &&
      (value as { isAxiosError?: boolean }).isAxiosError === true
  );
});

describe("fetchDistrictNames", () => {
  it("flattens the geo payload to the names a picker needs", async () => {
    api.get.mockResolvedValue({
      data: { districts: [{ district: "Colombo" }, { district: "Galle" }] },
    });

    await expect(fetchDistrictNames()).resolves.toEqual(["Colombo", "Galle"]);
  });
});

describe("submitHazardReport", () => {
  it("sends the report the citizen typed and returns the saved one", async () => {
    const report = {
      hazardType: "FLOOD",
      severityLevel: "HIGH",
      locationDistrict: "Colombo",
      description: "Water is up to the knees on Galle Road.",
      locationLat: 6.9271,
      locationLng: 79.8612,
    };

    api.post.mockResolvedValue({ data: { report: { ...report, id: "r-1" } } });

    const saved = await submitHazardReport("token-abc", report);

    expect(saved.id).toBe("r-1");
    expect(api.post).toHaveBeenCalledWith(
      expect.stringContaining("/reports"),
      report,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
      })
    );
  });

  it("keeps the server's per-field complaints attached to the error", async () => {
    api.post.mockRejectedValue(
      axiosError(400, {
        message: "Fix the highlighted fields.",
        errors: { description: "Say what you can see." },
      })
    );

    const failure = await submitHazardReport("token-abc", {
      hazardType: "FLOOD",
      severityLevel: "HIGH",
      locationDistrict: "Colombo",
      description: "",
    }).catch((error) => error);

    expect(failure).toBeInstanceOf(AlertApiError);
    expect((failure as AlertApiError).status).toBe(400);
    expect((failure as AlertApiError).message).toBe("Fix the highlighted fields.");
    expect((failure as AlertApiError).fieldErrors).toEqual({
      description: "Say what you can see.",
    });
  });
});

describe("error wording", () => {
  it("tells a citizen to check their connection rather than naming a socket", async () => {
    api.get.mockRejectedValue(axiosError(undefined));

    await expect(fetchDistrictNames()).rejects.toThrow(
      "Cannot reach SafePlus. Check your connection and try again."
    );
  });

  it("falls back to a plain sentence when the server sends no message", async () => {
    api.get.mockRejectedValue(axiosError(500, {}));

    await expect(fetchDistrictNames()).rejects.toThrow(
      "The request could not be completed."
    );
  });

  it("passes on a non-axios failure rather than losing it", async () => {
    api.get.mockRejectedValue(new Error("Storage is locked."));

    await expect(fetchDistrictNames()).rejects.toThrow("Storage is locked.");
  });
});

describe("fetchAlertInbox", () => {
  it("renames the delivered messages so the screen can list them", async () => {
    const messages = [
      {
        id: "a-1",
        warningId: "WARN-1",
        senderId: "DMC",
        levelLabel: "Level 3 - Immediate Evacuation",
        areaLabel: "Colombo District",
        instruction: "Move to higher ground now.",
        body: "SAFEPLUS ALERT",
        deliveredAt: "2026-10-09T08:00:00.000Z",
        warningStatus: "ACTIVE",
        hazardType: "FLOOD",
        severityLevel: "CRITICAL",
        targetDistrict: "Colombo",
      },
    ];

    api.get.mockResolvedValue({ data: { messages, unreadCount: 1 } });

    await expect(fetchAlertInbox("token-abc")).resolves.toEqual({
      alerts: messages,
      unreadCount: 1,
    });
  });
});

describe("saveAlertTarget", () => {
  it("stays quiet when there is neither a push token nor a position to store", async () => {
    await saveAlertTarget("token-abc", {});

    expect(api.put).not.toHaveBeenCalled();
  });

  it("sends a position alone, so a phone with push off is still counted", async () => {
    api.put.mockResolvedValue({ data: {} });

    await saveAlertTarget("token-abc", { latitude: 6.9271, longitude: 79.8612 });

    expect(api.put).toHaveBeenCalledWith(
      expect.stringContaining("/alert-target"),
      { latitude: 6.9271, longitude: 79.8612 },
      expect.anything()
    );
  });
});

describe("markAlertRead", () => {
  it("posts to the read route for that one message", async () => {
    api.put.mockResolvedValue({ data: {} });

    await markAlertRead("token-abc", "a-1");

    expect(api.put).toHaveBeenCalledWith(
      expect.stringContaining("/alert-inbox/a-1/read"),
      {},
      expect.anything()
    );
  });
});
