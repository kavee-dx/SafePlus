import axios from "axios";

import api from "./api";

/* ------------------------------------------------------------------ *
 * Shelter coordination client (Kaveesha).
 *
 * Mirrors the dispatch client exactly: the officer's district is decided by the
 * server from their assignment, so nothing here sends a district unless a caller
 * is an unassigned DMC duty officer narrowing the view. The same DispatchApiError
 * shape is reused conceptually but re-declared here so this module stands on its
 * own and the shelter desk can surface field-level validation the same way.
 * ------------------------------------------------------------------ */

export type ShelterBand = "AVAILABLE" | "LIMITED" | "FULL";

/** The four-band health reading the dashboards group shelters under. */
export type ShelterStatus = "CRITICAL" | "WARNING" | "STABLE" | "AVAILABLE";

export interface OccupancyTrendPoint {
  hour: string;
  occupancy: number;
}

/** A dashboard row: a shelter roll, its derived status, and who runs it. */
export type ShelterAnalyticsRow = Omit<ShelterRoll, "status"> & {
  status: ShelterStatus;
  managers: { id: string; fullName: string; email?: string; phone?: string }[];
};

/** Everything a shelter dashboard draws above its board. */
export interface ShelterAnalytics {
  district: string | null;
  districts: string[];
  generatedAt: string;
  totalBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  freeBeds: number;
  totalOccupancy: number;
  trend: OccupancyTrendPoint[];
  perShelterTrend: Record<string, OccupancyTrendPoint[]>;
  shelters: ShelterAnalyticsRow[];
}

export type EvacueeArrivalSource = "SELF" | "RESCUE_TEAM";

export type EvacueeGroupStatus =
  | "AWAITING_SHELTER"
  | "ALLOCATED"
  | "IN_TRANSIT"
  | "ARRIVAL_REPORTED"
  | "ARRIVED"
  | "PARTIAL"
  | "CANCELLED";

export type AllocationStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export type ShelterEventKind =
  | "WALK_IN"
  | "ARRIVAL_CONFIRMED"
  | "DEPARTURE"
  | "ADJUSTMENT"
  | "ALLOCATED"
  | "CANCELLED";

export interface ShelterRoll {
  id: string;
  shelterCode: string;
  name: string;
  district: string;
  address?: string;
  latitude: number;
  longitude: number;
  maxCapacity: number;
  confirmedOccupancy: number;
  pendingArrivals: number;
  remainingAllocatable: number;
  isActive: boolean;
  facilities: string[];
  distanceKm?: number;
  /** Present on citizen / manager listings where a band was computed. */
  status?: ShelterBand;
  createdAt: string;
  updatedAt: string;
}

export interface ShelterAllocation {
  id: string;
  groupId: string;
  shelterId: string;
  shelterCode: string;
  shelterName: string;
  allocatedCount: number;
  arrivedCount: number;
  status: AllocationStatus;
  allocatedByName?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  discrepancyNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvacueeGroup {
  id: string;
  groupCode: string;
  peopleCount: number;
  vulnerableCount: number;
  arrivalSource: EvacueeArrivalSource;
  district: string;
  originLatitude?: number;
  originLongitude?: number;
  sourceDispatchId?: string;
  incidentReportId?: string;
  status: EvacueeGroupStatus;
  allocations: ShelterAllocation[];
  createdAt: string;
  updatedAt: string;
}

export interface ShelterEvent {
  id: string;
  shelterId: string;
  groupId?: string;
  kind: ShelterEventKind;
  peopleDelta: number;
  note?: string;
  actorName?: string;
  actorRole?: string;
  createdAt: string;
}

export interface ShelterManager {
  id: string;
  userId: string;
  fullName: string;
  email?: string;
  phone?: string;
  designation?: string;
  district: string;
  status: "ACTIVE" | "SUSPENDED";
  shelterIds: string[];
  shelters: { id: string; shelterCode: string; name: string }[];
  createdAt: string;
}

export interface ShelterRecommendation {
  plan: {
    shelterId: string;
    shelterCode: string;
    name: string;
    district: string;
    count: number;
    distanceKm?: number;
    remainingAllocatable: number;
  }[];
  unmet: number;
  complete: boolean;
  singleShelterFits: boolean;
}

export interface NewShelterPayload {
  name: string;
  district?: string;
  address?: string;
  latitude: number;
  longitude: number;
  maxCapacity: number;
  facilities?: string[];
}

export interface ShelterPatchPayload {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  maxCapacity?: number;
  isActive?: boolean;
  facilities?: string[];
}

export interface AllocationLine {
  shelterId: string;
  count: number;
}

export interface NewGroupPayload {
  peopleCount: number;
  vulnerableCount?: number;
  district?: string;
  originLatitude?: number;
  originLongitude?: number;
}

export interface NewManagerPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  designation?: string;
  district?: string;
  shelterIds: string[];
}

export interface ManagerPatchPayload {
  status?: "ACTIVE" | "SUSPENDED";
  shelterIds?: string[];
}

export class ShelterApiError extends Error {
  readonly status: number | null;
  readonly fields: Record<string, string>;

  constructor(
    message: string,
    status: number | null,
    fields: Record<string, string> = {}
  ) {
    super(message);
    this.name = "ShelterApiError";
    this.status = status;
    this.fields = fields;
  }
}

function toError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new ShelterApiError(
        "Cannot reach the server. Check that the backend is running and try again.",
        null
      );
    }

    const body = error.response.data as {
      message?: string;
      errors?: Record<string, string>;
    };

    return new ShelterApiError(
      body?.message || "The shelter desk could not be loaded.",
      error.response.status,
      body?.errors ?? {}
    );
  }

  return error instanceof Error ? error : new Error("Something went wrong.");
}

function headersFor(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/* ------------------------------ shelters ------------------------------ */

/** The officer's shelter register, live capacity trio on every row. */
export async function fetchShelters(
  token: string,
  options: { activeOnly?: boolean } = {}
): Promise<ShelterRoll[]> {
  try {
    const { data } = await api.get("/shelters", {
      params: { status: options.activeOnly === false ? "all" : "active" },
      headers: headersFor(token),
    });

    return (data.shelters ?? []) as ShelterRoll[];
  } catch (error) {
    throw toError(error);
  }
}

/**
 * The officer dashboard figures for one district (or "all"). A District Officer
 * may READ any district here to switch the board; every write stays locked to
 * their own by the server, so browsing elsewhere can never edit it.
 */
export async function fetchShelterAnalytics(
  token: string,
  district?: string
): Promise<ShelterAnalytics> {
  try {
    const { data } = await api.get("/shelters/analytics", {
      params: district ? { district } : undefined,
      headers: headersFor(token),
    });

    return data as ShelterAnalytics;
  } catch (error) {
    throw toError(error);
  }
}

export async function fetchShelter(
  token: string,
  id: string
): Promise<{ shelter: ShelterRoll; events: ShelterEvent[] }> {
  try {
    const { data } = await api.get(`/shelters/${id}`, {
      headers: headersFor(token),
    });

    return { shelter: data.shelter, events: data.events ?? [] };
  } catch (error) {
    throw toError(error);
  }
}

export async function createShelter(
  token: string,
  payload: NewShelterPayload
): Promise<ShelterRoll> {
  try {
    const { data } = await api.post("/shelters", payload, {
      headers: headersFor(token),
    });

    return data.shelter as ShelterRoll;
  } catch (error) {
    throw toError(error);
  }
}

export async function updateShelter(
  token: string,
  id: string,
  patch: ShelterPatchPayload
): Promise<ShelterRoll> {
  try {
    const { data } = await api.patch(`/shelters/${id}`, patch, {
      headers: headersFor(token),
    });

    return data.shelter as ShelterRoll;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * "Where do I send them?" — nearest suitable shelter, or a multi-shelter split
 * with the shortfall spelled out when nothing nearby can take the whole group.
 */
export async function recommendShelters(
  token: string,
  params: { latitude: number; longitude: number; people: number }
): Promise<ShelterRecommendation> {
  try {
    const { data } = await api.get("/shelters/recommend", {
      params: {
        lat: params.latitude,
        lng: params.longitude,
        people: params.people,
      },
      headers: headersFor(token),
    });

    return data.recommendation as ShelterRecommendation;
  } catch (error) {
    throw toError(error);
  }
}

/* --------------------------- evacuee groups --------------------------- */

export async function fetchGroups(
  token: string,
  includeClosed: boolean
): Promise<EvacueeGroup[]> {
  try {
    const { data } = await api.get("/shelter-groups", {
      params: { status: includeClosed ? "all" : "open" },
      headers: headersFor(token),
    });

    return (data.groups ?? []) as EvacueeGroup[];
  } catch (error) {
    throw toError(error);
  }
}

export async function createGroup(
  token: string,
  payload: NewGroupPayload
): Promise<EvacueeGroup> {
  try {
    const { data } = await api.post("/shelter-groups", payload, {
      headers: headersFor(token),
    });

    return data.group as EvacueeGroup;
  } catch (error) {
    throw toError(error);
  }
}

export async function allocateGroup(
  token: string,
  groupId: string,
  allocations: AllocationLine[]
): Promise<EvacueeGroup> {
  try {
    const { data } = await api.post(
      `/shelter-groups/${groupId}/allocate`,
      { allocations },
      { headers: headersFor(token) }
    );

    return data.group as EvacueeGroup;
  } catch (error) {
    throw toError(error);
  }
}

export async function cancelGroupAllocation(
  token: string,
  groupId: string
): Promise<EvacueeGroup> {
  try {
    const { data } = await api.post(
      `/shelter-groups/${groupId}/cancel`,
      {},
      { headers: headersFor(token) }
    );

    return data.group as EvacueeGroup;
  } catch (error) {
    throw toError(error);
  }
}

/* --------------------------- manager accounts --------------------------- */

export async function fetchShelterManagers(
  token: string
): Promise<ShelterManager[]> {
  try {
    const { data } = await api.get("/shelter-managers", {
      headers: headersFor(token),
    });

    return (data.managers ?? []) as ShelterManager[];
  } catch (error) {
    throw toError(error);
  }
}

export async function createShelterManager(
  token: string,
  payload: NewManagerPayload
): Promise<ShelterManager> {
  try {
    const { data } = await api.post("/shelter-managers", payload, {
      headers: headersFor(token),
    });

    return data.manager as ShelterManager;
  } catch (error) {
    throw toError(error);
  }
}

export async function updateShelterManager(
  token: string,
  managerId: string,
  patch: ManagerPatchPayload
): Promise<ShelterManager> {
  try {
    const { data } = await api.patch(`/shelter-managers/${managerId}`, patch, {
      headers: headersFor(token),
    });

    return data.manager as ShelterManager;
  } catch (error) {
    throw toError(error);
  }
}

/* ------------------------------ live feed ------------------------------ */

export interface ShelterLiveEvent {
  kind: "dispatch" | "incident" | "shelter" | "hello";
  district?: string;
  reportId?: string;
  dispatchCode?: string;
  teamName?: string;
  status?: string;
  shelterId?: string;
  groupCode?: string;
  message?: string;
  at?: string;
}

export type ShelterStreamState = "connecting" | "live" | "retrying" | "closed";

export interface ShelterStreamHandle {
  close: () => void;
}

const STREAM_RETRY_MS = 4_000;
const STREAM_RETRY_LIMIT_MS = 20_000;

function readFrames(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: string[] = [];

  for (const part of parts) {
    const data = part
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");

    if (data !== "" && !data.startsWith(":")) events.push(data);
  }

  return { events, rest };
}

/**
 * The same district-keyed SSE bus the dispatch board uses, read straight from
 * the shelter stream route so the shelter desk updates the instant a group is
 * allocated or someone is confirmed in. Not EventSource, for the reasons the
 * dispatch stream documents (an EventSource cannot carry the Authorization
 * header). A dropped stream degrades to the slow poll, never to a blind desk.
 */
export function openShelterStream(options: {
  token: string;
  onEvent: (event: ShelterLiveEvent) => void;
  onState?: (state: ShelterStreamState) => void;
}): ShelterStreamHandle {
  const base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  const controller = new AbortController();
  let closed = false;
  let retryIn = STREAM_RETRY_MS;

  const run = async () => {
    while (!closed) {
      try {
        options.onState?.("connecting");

        const response = await fetch(`${base}/shelters/stream`, {
          headers: {
            Authorization: `Bearer ${options.token}`,
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`stream refused (${response.status})`);
        }

        retryIn = STREAM_RETRY_MS;
        options.onState?.("live");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const { events, rest } = readFrames(buffer);
          buffer = rest;

          for (const payload of events) {
            try {
              options.onEvent(JSON.parse(payload) as ShelterLiveEvent);
            } catch {
              // A half-written frame is not worth losing the connection over.
            }
          }
        }
      } catch (error) {
        if (closed || (error as Error).name === "AbortError") break;
      }

      if (closed) break;

      options.onState?.("retrying");

      await new Promise((resolve) => setTimeout(resolve, retryIn));

      retryIn = Math.min(retryIn * 2, STREAM_RETRY_LIMIT_MS);
    }

    options.onState?.("closed");
  };

  void run();

  return {
    close: () => {
      closed = true;
      controller.abort();
    },
  };
}
