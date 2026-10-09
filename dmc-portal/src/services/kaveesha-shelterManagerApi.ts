import axios from "axios";

import api from "./api";
import type {
  EvacueeGroup,
  ShelterAllocation,
  ShelterAnalytics,
  ShelterBand,
  ShelterManager,
  ShelterRoll,
} from "./kaveesha-shelterApi";

/* ------------------------------------------------------------------ *
 * Shelter Manager workspace client (Kaveesha).
 *
 * Everything a manager does is scoped by the server to the shelters assigned to
 * the signed-in account, so nothing here sends a shelter id it does not already
 * know about from the manager's own list. The response types are shared with the
 * officer client so the two dashboards never drift on the shape of a row.
 * ------------------------------------------------------------------ */

export type {
  EvacueeGroup,
  ShelterAllocation,
  ShelterAnalytics,
  ShelterAnalyticsRow,
  ShelterBand,
  ShelterManager,
  ShelterRoll,
} from "./kaveesha-shelterApi";

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
      body?.message || "Your shelter workspace could not be loaded.",
      error.response.status,
      body?.errors ?? {}
    );
  }

  return error instanceof Error ? error : new Error("Something went wrong.");
}

function headersFor(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** The signed-in manager and the shelters they run. */
export async function fetchManagerProfile(
  token: string
): Promise<ShelterManager> {
  try {
    const { data } = await api.get("/shelter-manager/profile", {
      headers: headersFor(token),
    });

    return data.manager as ShelterManager;
  } catch (error) {
    throw toError(error);
  }
}

/** Live capacity for the shelters this manager owns, each with a band. */
export async function fetchMyShelters(
  token: string
): Promise<(ShelterRoll & { status: ShelterBand })[]> {
  try {
    const { data } = await api.get("/shelter-manager/shelters", {
      headers: headersFor(token),
    });

    return (data.shelters ?? []) as (ShelterRoll & { status: ShelterBand })[];
  } catch (error) {
    throw toError(error);
  }
}

/** Reservations still inbound to this manager's shelters. */
export async function fetchExpectedArrivals(
  token: string
): Promise<ShelterAllocation[]> {
  try {
    const { data } = await api.get("/shelter-manager/expected-arrivals", {
      headers: headersFor(token),
    });

    return (data.arrivals ?? []) as ShelterAllocation[];
  } catch (error) {
    throw toError(error);
  }
}

/** The manager dashboard figures, scoped to just the shelters they run. */
export async function fetchManagerAnalytics(
  token: string
): Promise<ShelterAnalytics> {
  try {
    const { data } = await api.get("/shelter-manager/analytics", {
      headers: headersFor(token),
    });

    return data as ShelterAnalytics;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * The one action that raises occupancy: a group arrived, and this is how many of
 * them actually walked through the door. Fewer than allocated records a note.
 */
export async function confirmArrival(
  token: string,
  allocationId: string,
  arrivedCount: number,
  discrepancyNote?: string
): Promise<{ group: EvacueeGroup; shelter: ShelterRoll }> {
  try {
    const { data } = await api.post(
      `/shelter-manager/allocations/${allocationId}/confirm-arrival`,
      { arrivedCount, discrepancyNote },
      { headers: headersFor(token) }
    );

    return { group: data.group as EvacueeGroup, shelter: data.shelter as ShelterRoll };
  } catch (error) {
    throw toError(error);
  }
}

/** People who turned up with no allocation. Counts immediately. */
export async function recordWalkIn(
  token: string,
  shelterId: string,
  people: number,
  vulnerable?: number
): Promise<{ group: EvacueeGroup; shelter: ShelterRoll }> {
  try {
    const { data } = await api.post(
      `/shelter-manager/shelters/${shelterId}/walk-in`,
      { people, vulnerable },
      { headers: headersFor(token) }
    );

    return { group: data.group as EvacueeGroup, shelter: data.shelter as ShelterRoll };
  } catch (error) {
    throw toError(error);
  }
}

/** People leaving. Only ever reduces confirmed occupancy, floored at zero. */
export async function recordDeparture(
  token: string,
  shelterId: string,
  people: number,
  reason?: string
): Promise<ShelterRoll> {
  try {
    const { data } = await api.post(
      `/shelter-manager/shelters/${shelterId}/departure`,
      { people, reason },
      { headers: headersFor(token) }
    );

    return data.shelter as ShelterRoll;
  } catch (error) {
    throw toError(error);
  }
}

/* ------------------------------ live feed ------------------------------ */

export interface ManagerLiveEvent {
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

export type ManagerStreamState = "connecting" | "live" | "retrying" | "closed";

export interface ManagerStreamHandle {
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

/** The manager's own district-keyed shelter feed, read like the officer stream. */
export function openManagerStream(options: {
  token: string;
  onEvent: (event: ManagerLiveEvent) => void;
  onState?: (state: ManagerStreamState) => void;
}): ManagerStreamHandle {
  const base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  const controller = new AbortController();
  let closed = false;
  let retryIn = STREAM_RETRY_MS;

  const run = async () => {
    while (!closed) {
      try {
        options.onState?.("connecting");

        const response = await fetch(`${base}/shelter-manager/stream`, {
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
              options.onEvent(JSON.parse(payload) as ManagerLiveEvent);
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
