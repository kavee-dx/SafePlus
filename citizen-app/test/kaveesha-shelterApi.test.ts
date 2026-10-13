import axios from "axios";

import {
  BAND_META,
  ShelterApiError,
  fetchNearbyShelters,
  formatDistance,
  mapsDirectionsUrl,
  occupancyPct,
} from "../src/services/kaveesha-shelterApi";
import type { NearbyShelter } from "../src/services/kaveesha-shelterApi";

jest.mock("axios");

const api = axios as unknown as {
  get: jest.Mock;
  isAxiosError: jest.Mock;
};

function axiosError(status: number | undefined, data?: unknown) {
  return {
    isAxiosError: true,
    message: "Request failed",
    response: status === undefined ? undefined : { status, data },
  };
}

function roll(overrides: Partial<NearbyShelter>): NearbyShelter {
  return {
    id: "s-1",
    shelterCode: "SH-01",
    name: "Hall",
    district: "Colombo",
    latitude: 6.9271,
    longitude: 79.8612,
    maxCapacity: 100,
    confirmedOccupancy: 40,
    pendingArrivals: 10,
    remainingAllocatable: 50,
    facilities: [],
    status: "AVAILABLE",
    ...overrides,
  };
}

beforeEach(() => {
  api.isAxiosError.mockImplementation(
    (value: unknown) =>
      typeof value === "object" &&
      value !== null &&
      (value as { isAxiosError?: boolean }).isAxiosError === true
  );
});

describe("fetchNearbyShelters", () => {
  it("returns the shelters the server sent", async () => {
    const shelters = [roll({ id: "a" }), roll({ id: "b" })];
    api.get.mockResolvedValue({ data: { shelters } });

    await expect(fetchNearbyShelters("tok", {})).resolves.toEqual(shelters);
  });

  it("returns an empty list when the payload carries no shelters", async () => {
    api.get.mockResolvedValue({ data: {} });

    await expect(fetchNearbyShelters("tok", {})).resolves.toEqual([]);
  });

  it("sends both coordinates when the phone has a full GPS fix", async () => {
    api.get.mockResolvedValue({ data: { shelters: [] } });

    await fetchNearbyShelters("tok", { latitude: 6.9, longitude: 79.8 });

    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining("/shelters/nearby"),
      expect.objectContaining({ params: { lat: "6.9", lng: "79.8" } })
    );
  });

  it("ignores a half-fix rather than sending a lone coordinate", async () => {
    api.get.mockResolvedValue({ data: { shelters: [] } });

    await fetchNearbyShelters("tok", { latitude: 6.9 });

    expect(api.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: {} })
    );
  });

  it("trims and forwards a district for the manual fallback", async () => {
    api.get.mockResolvedValue({ data: { shelters: [] } });

    await fetchNearbyShelters("tok", { district: "  Galle  " });

    expect(api.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { district: "Galle" } })
    );
  });

  it("attaches the bearer token and a timeout to the call", async () => {
    api.get.mockResolvedValue({ data: { shelters: [] } });

    await fetchNearbyShelters("secret", {});

    expect(api.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        timeout: 15000,
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      })
    );
  });
});

describe("fetchNearbyShelters error handling", () => {
  it("tells a citizen to check their connection when the network is unreachable", async () => {
    api.get.mockRejectedValue(axiosError(undefined));

    const failure = await fetchNearbyShelters("tok", {}).catch((error) => error);

    expect(failure).toBeInstanceOf(ShelterApiError);
    expect((failure as ShelterApiError).status).toBeNull();
    expect((failure as ShelterApiError).message).toBe(
      "Cannot reach SafePlus. Check your connection and try again."
    );
  });

  it("surfaces the server's own message and status code", async () => {
    api.get.mockRejectedValue(axiosError(403, { message: "Verify your account first." }));

    const failure = await fetchNearbyShelters("tok", {}).catch((error) => error);

    expect((failure as ShelterApiError).status).toBe(403);
    expect((failure as ShelterApiError).message).toBe("Verify your account first.");
  });

  it("falls back to a plain sentence when an error response has no message", async () => {
    api.get.mockRejectedValue(axiosError(500, {}));

    await expect(fetchNearbyShelters("tok", {})).rejects.toThrow(
      "The request could not be completed."
    );
  });

  it("wraps a non-axios failure rather than losing it", async () => {
    api.get.mockRejectedValue(new Error("Something odd happened"));

    const failure = await fetchNearbyShelters("tok", {}).catch((error) => error);

    expect(failure).toBeInstanceOf(ShelterApiError);
    expect((failure as ShelterApiError).status).toBeNull();
    expect((failure as ShelterApiError).message).toBe("Something odd happened");
  });
});

describe("BAND_META", () => {
  it("describes each capacity band with its own colours", () => {
    expect(Object.keys(BAND_META).sort()).toEqual(["AVAILABLE", "FULL", "LIMITED"]);
    expect(BAND_META.FULL.label).toBe("Full");
    expect(BAND_META.AVAILABLE.bg).not.toBe(BAND_META.LIMITED.bg);
    expect(BAND_META.AVAILABLE.bar.startsWith("#")).toBe(true);
  });
});

describe("formatDistance", () => {
  it("shows metres below a kilometre and one decimal above", () => {
    expect(formatDistance(0.64)).toBe("640 m");
    expect(formatDistance(3.44)).toBe("3.4 km");
    expect(formatDistance(1)).toBe("1.0 km");
  });

  it("shows a dash when there is no distance to display", () => {
    expect(formatDistance(null)).toBe("—");
    expect(formatDistance(undefined)).toBe("—");
    expect(formatDistance(Number.NaN)).toBe("—");
    expect(formatDistance("3" as unknown as number)).toBe("—");
  });
});

describe("occupancyPct", () => {
  it("rounds the share of beds taken and clamps it to the bar", () => {
    expect(occupancyPct(roll({ maxCapacity: 100, confirmedOccupancy: 40 }))).toBe(40);
    expect(occupancyPct(roll({ maxCapacity: 3, confirmedOccupancy: 2 }))).toBe(67);
    expect(occupancyPct(roll({ maxCapacity: 100, confirmedOccupancy: 150 }))).toBe(100);
  });

  it("reports nothing when capacity is undefined", () => {
    expect(occupancyPct(roll({ maxCapacity: 0 }))).toBe(0);
    expect(occupancyPct(roll({ maxCapacity: -10, confirmedOccupancy: 5 }))).toBe(0);
  });
});

describe("mapsDirectionsUrl", () => {
  it("points Google Maps at the shelter's coordinates", () => {
    expect(mapsDirectionsUrl(roll({ latitude: 6.9, longitude: 79.8 }))).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=6.9,79.8"
    );
  });
});
