import axios, { type AxiosRequestConfig } from "axios";

/* ------------------------------------------------------------------ *
 * The citizen's view of shelters (mobile).
 *
 * A person in a flood does not need the officer's whole model — they need one
 * honest answer: "here are the shelters near me, and which still have room."
 * This file reads the citizen endpoint (the same central records the district
 * desk and shelter managers write), sorts nearest-first off the handset's GPS,
 * and falls back to a district list when the signal is lost. Nothing here can
 * change a shelter — it is read-only by design.
 * ------------------------------------------------------------------ */

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:5000/api";

/** The three-band capacity answer, matching the server's `bandFor`. */
export type ShelterBand = "AVAILABLE" | "LIMITED" | "FULL";

export interface NearbyShelter {
  id: string;
  shelterCode: string;
  name: string;
  district: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  maxCapacity: number;
  confirmedOccupancy: number;
  pendingArrivals: number;
  remainingAllocatable: number;
  facilities: string[];
  /** Straight-line km from the citizen's point; absent on the district fallback. */
  distanceKm?: number | null;
  status: ShelterBand;
}

export class ShelterApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message);
    this.name = "ShelterApiError";
  }
}

function request(token: string): AxiosRequestConfig {
  return {
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
}

function toError(error: unknown): ShelterApiError {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new ShelterApiError(
        "Cannot reach SafePlus. Check your connection and try again.",
        null
      );
    }

    const body = error.response.data as { message?: string };

    return new ShelterApiError(
      body?.message ?? "The request could not be completed.",
      error.response.status
    );
  }

  return new ShelterApiError(
    error instanceof Error ? error.message : "Unexpected error.",
    null
  );
}

/**
 * Shelters near a person. With a GPS fix the server sorts nearest-first; without
 * one (or once the user opts for the manual fallback) pass a district and it
 * lists that district's open shelters. Both return the same live band + the map
 * coordinates, so the screen never has to know which path it took.
 */
export async function fetchNearbyShelters(
  token: string,
  point: { latitude?: number; longitude?: number; district?: string }
): Promise<NearbyShelter[]> {
  const params: Record<string, string> = {};

  if (typeof point.latitude === "number" && typeof point.longitude === "number") {
    params.lat = String(point.latitude);
    params.lng = String(point.longitude);
  }

  const district = point.district?.trim();

  if (district) params.district = district;

  try {
    const { data } = await axios.get(`${BASE_URL}/shelters/nearby`, {
      ...request(token),
      params,
    });

    return (data.shelters ?? []) as NearbyShelter[];
  } catch (error) {
    throw toError(error);
  }
}

/* ------------------------------------------------------------------ *
 * Reading helpers, kept here so both the citizen screen and the leader's
 * mission card speak the same capacity language.
 * ------------------------------------------------------------------ */

export interface BandMeta {
  label: string;
  /** Filled chip background. */
  bg: string;
  /** Chip text colour. */
  fg: string;
  /** The progress-bar colour for the band. */
  bar: string;
}

export const BAND_META: Record<ShelterBand, BandMeta> = {
  AVAILABLE: { label: "Available", bg: "#DCFCE7", fg: "#14532D", bar: "#16A34A" },
  LIMITED: { label: "Limited", bg: "#FEF0C7", fg: "#B54708", bar: "#F79009" },
  FULL: { label: "Full", bg: "#FEE4E2", fg: "#B42318", bar: "#D92D20" },
};

/** "3.4 km" / "640 m" / "—" when there is no distance to show. */
export function formatDistance(km: number | null | undefined): string {
  if (typeof km !== "number" || !Number.isFinite(km)) return "—";

  if (km < 1) return `${Math.round(km * 1000)} m`;

  return `${km.toFixed(1)} km`;
}

/** The occupancy percentage for a shelter, clamped to the bar's range. */
export function occupancyPct(shelter: NearbyShelter): number {
  if (shelter.maxCapacity <= 0) return 0;

  return Math.max(0, Math.min(100, Math.round((shelter.confirmedOccupancy / shelter.maxCapacity) * 100)));
}

/** A Google Maps directions URL to the shelter's door — the "get me there" tap. */
export function mapsDirectionsUrl(shelter: NearbyShelter): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${shelter.latitude},${shelter.longitude}`;
}
