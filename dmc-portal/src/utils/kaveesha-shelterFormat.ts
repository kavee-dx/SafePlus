import { Colors } from "../constants/theme";
import type { ShelterBand, ShelterRoll, ShelterStatus } from "../services/kaveesha-shelterApi";

/* ------------------------------------------------------------------ *
 * Shelter display helpers.
 *
 * The capacity trio is the whole point of the screen, so how a band looks and
 * how a bar reads are decided in one place and reused by every shelter surface.
 * ------------------------------------------------------------------ */

export const BAND_META: Record<
  ShelterBand,
  { label: string; color: string; chip: string }
> = {
  AVAILABLE: {
    label: "Available",
    color: Colors.success,
    chip: "kdx-chip-good",
  },
  LIMITED: {
    label: "Limited",
    color: Colors.amber,
    chip: "kdx-chip-warn",
  },
  FULL: {
    label: "Full",
    color: Colors.red,
    chip: "kdx-chip-alert",
  },
};

/** The same rule the server uses, so a card never disagrees with the API band. */
export function bandFor(
  shelter: Pick<
    ShelterRoll,
    "maxCapacity" | "confirmedOccupancy" | "remainingAllocatable"
  >,
  requested?: number
): ShelterBand {
  if (shelter.remainingAllocatable <= 0) return "FULL";

  if (requested !== undefined) {
    return shelter.remainingAllocatable >= requested ? "AVAILABLE" : "LIMITED";
  }

  const crowded =
    shelter.maxCapacity > 0 &&
    shelter.confirmedOccupancy / shelter.maxCapacity >= 0.8;

  return crowded ? "LIMITED" : "AVAILABLE";
}

/** Whole percentage of a shelter's beds already occupied by confirmed people. */
export function occupancyPct(
  shelter: Pick<ShelterRoll, "maxCapacity" | "confirmedOccupancy">
): number {
  if (shelter.maxCapacity <= 0) return 0;

  return Math.min(
    100,
    Math.round((shelter.confirmedOccupancy / shelter.maxCapacity) * 100)
  );
}

/* The four-band health reading the dashboards group shelters under. Same rule
 * the server's statusFor uses, ordered most urgent first so the board reads
 * left to right as a triage line. */
export const STATUS_META: Record<
  ShelterStatus,
  { label: string; color: string; chip: string; hint: string }
> = {
  CRITICAL: {
    label: "Critical",
    color: Colors.red,
    chip: "kdx-chip-alert",
    hint: "No space left to claim.",
  },
  WARNING: {
    label: "Warning",
    color: Colors.amber,
    chip: "kdx-chip-warn",
    hint: "Nearly full — 80% or more confirmed inside.",
  },
  STABLE: {
    label: "Stable",
    color: Colors.blue,
    chip: "kdx-chip-info",
    hint: "Filling steadily, room still available.",
  },
  AVAILABLE: {
    label: "Available",
    color: Colors.success,
    chip: "kdx-chip-good",
    hint: "Plenty of room to take people.",
  },
};

/** The order the status columns appear in — urgent first. */
export const STATUS_ORDER: ShelterStatus[] = [
  "CRITICAL",
  "WARNING",
  "STABLE",
  "AVAILABLE",
];

/** A client-side mirror of the server's statusFor, for rows lacking a band. */
export function statusFor(
  shelter: Pick<
    ShelterRoll,
    "maxCapacity" | "confirmedOccupancy" | "remainingAllocatable"
  >
): ShelterStatus {
  if (shelter.remainingAllocatable <= 0) return "CRITICAL";

  const ratio =
    shelter.maxCapacity > 0
      ? shelter.confirmedOccupancy / shelter.maxCapacity
      : 1;

  if (ratio >= 0.8) return "WARNING";
  if (ratio >= 0.5) return "STABLE";
  return "AVAILABLE";
}

/**
 * The capacity pie's three slices, straight from the trio: beds inside, beds
 * reserved but not arrived, and beds genuinely free. Blue / amber / green so it
 * reads like the bands it sits beside.
 */
export function capacitySegments(beds: {
  occupiedBeds: number;
  reservedBeds: number;
  freeBeds: number;
}): { label: string; value: number; color: string }[] {
  return [
    { label: "Inside now", value: beds.occupiedBeds, color: Colors.blue },
    { label: "Reserved (inbound)", value: beds.reservedBeds, color: Colors.amber },
    { label: "Free", value: beds.freeBeds, color: Colors.success },
  ];
}

/** Percentage of a shelter's capacity claimed between confirmed + pending. */
export function claimedPct(
  shelter: Pick<
    ShelterRoll,
    "maxCapacity" | "confirmedOccupancy" | "pendingArrivals"
  >
): number {
  if (shelter.maxCapacity <= 0) return 0;

  return Math.min(
    100,
    Math.round(
      ((shelter.confirmedOccupancy + shelter.pendingArrivals) /
        shelter.maxCapacity) *
        100
    )
  );
}

export function formatKm(km: number | undefined): string {
  if (km === undefined || !Number.isFinite(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)} m away`;

  return `${km.toFixed(km < 10 ? 1 : 0)} km away`;
}

export function groupStatusMeta(
  status: string
): { label: string; chip: string } {
  switch (status) {
    case "AWAITING_SHELTER":
      return { label: "Awaiting a shelter", chip: "kdx-chip-warn" };
    case "ALLOCATED":
      return { label: "Allocated", chip: "kdx-chip-info" };
    case "IN_TRANSIT":
      return { label: "In transit", chip: "kdx-chip-info" };
    case "ARRIVAL_REPORTED":
      return { label: "Arrival reported", chip: "kdx-chip-info" };
    case "ARRIVED":
      return { label: "Arrived", chip: "kdx-chip-good" };
    case "PARTIAL":
      return { label: "Partially arrived", chip: "kdx-chip-warn" };
    case "CANCELLED":
      return { label: "Cancelled", chip: "" };
    default:
      return { label: status.replace(/_/g, " ").toLowerCase(), chip: "" };
  }
}
