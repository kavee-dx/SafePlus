import { describe, expect, it } from "vitest";

import { Colors } from "../src/constants/theme";
import {
  BAND_META,
  STATUS_META,
  STATUS_ORDER,
  bandFor,
  capacitySegments,
  claimedPct,
  formatKm,
  groupStatusMeta,
  occupancyPct,
  statusFor,
} from "../src/utils/kaveesha-shelterFormat";

type Beds = {
  maxCapacity: number;
  confirmedOccupancy: number;
  remainingAllocatable: number;
  pendingArrivals: number;
};

const shelter = (overrides: Partial<Beds>): Beds => ({
  maxCapacity: 100,
  confirmedOccupancy: 40,
  remainingAllocatable: 60,
  pendingArrivals: 0,
  ...overrides,
});

describe("bandFor", () => {
  it("reads FULL once nothing can be claimed", () => {
    expect(bandFor(shelter({ remainingAllocatable: 0 }))).toBe("FULL");
    expect(bandFor(shelter({ remainingAllocatable: -5 }))).toBe("FULL");
  });

  it("judges against a requested headcount when one is given", () => {
    expect(bandFor(shelter({ remainingAllocatable: 20 }), 10)).toBe("AVAILABLE");
    expect(bandFor(shelter({ remainingAllocatable: 20 }), 20)).toBe("AVAILABLE");
    expect(bandFor(shelter({ remainingAllocatable: 20 }), 21)).toBe("LIMITED");
  });

  it("uses the 80% crowding rule when no headcount is supplied", () => {
    expect(bandFor(shelter({ maxCapacity: 100, confirmedOccupancy: 80, remainingAllocatable: 20 }))).toBe("LIMITED");
    expect(bandFor(shelter({ maxCapacity: 100, confirmedOccupancy: 79, remainingAllocatable: 21 }))).toBe("AVAILABLE");
  });

  it("calls a shelter with no defined capacity available rather than crowded", () => {
    expect(bandFor(shelter({ maxCapacity: 0, confirmedOccupancy: 0, remainingAllocatable: 5 }))).toBe("AVAILABLE");
  });
});

describe("occupancyPct", () => {
  it("rounds the share of beds already inside", () => {
    expect(occupancyPct(shelter({ maxCapacity: 100, confirmedOccupancy: 40 }))).toBe(40);
    expect(occupancyPct(shelter({ maxCapacity: 3, confirmedOccupancy: 2 }))).toBe(67);
  });

  it("clamps a nonsense reading into the bar's range", () => {
    expect(occupancyPct(shelter({ maxCapacity: 100, confirmedOccupancy: 150 }))).toBe(100);
    expect(occupancyPct(shelter({ maxCapacity: 0 }))).toBe(0);
    expect(occupancyPct(shelter({ maxCapacity: -10, confirmedOccupancy: 5 }))).toBe(0);
  });
});

describe("statusFor", () => {
  it("triages from most to least urgent by occupancy ratio", () => {
    expect(statusFor(shelter({ remainingAllocatable: 0 }))).toBe("CRITICAL");
    expect(statusFor(shelter({ maxCapacity: 100, confirmedOccupancy: 85, remainingAllocatable: 15 }))).toBe("WARNING");
    expect(statusFor(shelter({ maxCapacity: 100, confirmedOccupancy: 60, remainingAllocatable: 40 }))).toBe("STABLE");
    expect(statusFor(shelter({ maxCapacity: 100, confirmedOccupancy: 20, remainingAllocatable: 80 }))).toBe("AVAILABLE");
  });

  it("treats an undefined capacity as fully occupied", () => {
    expect(statusFor(shelter({ maxCapacity: 0, confirmedOccupancy: 0, remainingAllocatable: 5 }))).toBe("WARNING");
  });
});

describe("capacitySegments", () => {
  it("splits beds into inside, reserved and free with matching values", () => {
    const segments = capacitySegments({ occupiedBeds: 30, reservedBeds: 10, freeBeds: 60 });

    expect(segments).toHaveLength(3);
    expect(segments.map((s) => s.value)).toEqual([30, 10, 60]);
    expect(segments.every((s) => typeof s.label === "string" && s.label.length > 0)).toBe(true);
    expect(segments.every((s) => s.color.startsWith("#"))).toBe(true);
  });
});

describe("claimedPct", () => {
  it("counts confirmed and inbound people together", () => {
    expect(claimedPct(shelter({ maxCapacity: 100, confirmedOccupancy: 40, pendingArrivals: 15 }))).toBe(55);
  });

  it("caps at 100 and guards against an undefined capacity", () => {
    expect(claimedPct(shelter({ maxCapacity: 100, confirmedOccupancy: 90, pendingArrivals: 30 }))).toBe(100);
    expect(claimedPct(shelter({ maxCapacity: 0, confirmedOccupancy: 10, pendingArrivals: 5 }))).toBe(0);
  });
});

describe("formatKm", () => {
  it("switches to metres below a kilometre", () => {
    expect(formatKm(0.5)).toBe("500 m away");
  });

  it("uses one decimal under ten kilometres and none beyond", () => {
    expect(formatKm(4.25)).toBe("4.3 km away");
    expect(formatKm(25.6)).toBe("26 km away");
  });

  it("returns an empty string when there is no usable distance", () => {
    expect(formatKm(undefined)).toBe("");
    expect(formatKm(Number.NaN)).toBe("");
  });
});

describe("groupStatusMeta", () => {
  it("labels each known movement stage", () => {
    expect(groupStatusMeta("ARRIVED")).toEqual({ label: "Arrived", chip: "kdx-chip-good" });
    expect(groupStatusMeta("AWAITING_SHELTER").label).toBe("Awaiting a shelter");
    expect(groupStatusMeta("PARTIAL").chip).toBe("kdx-chip-warn");
  });

  it("degrades an unknown status into a readable lowercase phrase", () => {
    expect(groupStatusMeta("STRANGE_STATE")).toEqual({ label: "strange state", chip: "" });
  });
});

describe("shelter display tables", () => {
  it("keys BAND_META to the three capacity bands", () => {
    expect(Object.keys(BAND_META).sort()).toEqual(["AVAILABLE", "FULL", "LIMITED"]);
    expect(BAND_META.FULL.color).toBe(Colors.red);
  });

  it("orders the four health statuses urgent-first", () => {
    expect(STATUS_ORDER).toEqual(["CRITICAL", "WARNING", "STABLE", "AVAILABLE"]);
    expect(STATUS_ORDER.every((s) => STATUS_META[s].label.length > 0)).toBe(true);
    expect(STATUS_META.CRITICAL.hint).toContain("No space");
  });
});
