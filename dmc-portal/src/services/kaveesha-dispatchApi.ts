import axios from "axios";

import api from "./api";

/* ------------------------------------------------------------------ *
 * Rescue dispatch client (UC-03).
 *
 * The officer's district is decided by the server from their assignment, so
 * nothing here sends a district unless the caller is an unassigned DMC duty
 * officer who wants to narrow the view.
 * ------------------------------------------------------------------ */

export type DispatchStatus =
  | "DISPATCHED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "RESCUE_IN_PROGRESS"
  | "RETURNING"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED";

export interface EvidenceFile {
  id: string;
  reportId: string;
  /** A data URL for uploads, or a remote URL — either way <img src> renders it. */
  fileUrl: string;
  fileKind: "PHOTO" | "VIDEO" | "AUDIO" | "DOCUMENT" | string;
  contentType?: string | null;
  createdAt?: string | null;
}

export interface IncidentSummary {
  id: string;
  reportId: string;
  hazardType: string;
  severityLevel: string;
  locationDistrict: string;
  locationLat?: number | null;
  locationLng?: number | null;
  landmark?: string | null;
  description: string;
  affectedPopulation?: number | null;
  immediateDanger: boolean;
  observedAt?: string | null;
  verifiedAt?: string | null;
  verifiedByName?: string | null;
  reporterName?: string | null;
  reporterPhone?: string | null;
  photoCount: number;
  /** The first photo, so a list can show the scene before anything is opened. */
  thumbnailUrl?: string | null;
  liveDispatchCount: number;
  /** Every mission this incident has had, closed ones included. */
  dispatchCount: number;
  /**
   * Set once the district office has taken the incident on. Verification says a
   * report is true — that is the DMC officer's gate — this is the district's own
   * "we are working it" stamp, and it is what the desk acts on.
   */
  acceptedAt?: string | null;
  acceptedByName?: string | null;
  handoverNote?: string | null;
}

export interface TeamCandidate {
  teamId: string;
  teamName: string;
  teamType?: string | null;
  affiliation: string;
  organizationName?: string | null;
  district: string;
  outsideDistrict: boolean;
  availability: string;
  leaderFullName: string;
  leaderPhone: string;
  leaderDesignation?: string | null;
  teamContactNumber?: string | null;
  memberCount: number;
  capabilities: string[];
  equipment: string[];
  baseLatitude?: number | null;
  baseLongitude?: number | null;
  baseLocationLabel?: string | null;
  distanceKm: number;
  etaMinutes: number;
  score: number;
  reasons: string[];
  breakdown: {
    reach: number;
    capability: number;
    workload: number;
    readiness: number;
  };
  liveDispatches: number;
}

export interface ExcludedTeam {
  teamId: string;
  teamName: string;
  teamType?: string | null;
  district: string;
  availability: string;
  reason: string;
}

export interface DispatchEvent {
  id: string;
  fromStatus: DispatchStatus | null;
  toStatus: DispatchStatus;
  actorId?: string | null;
  actorRole?: string | null;
  actorName?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface DispatchRoll {
  id: string;
  dispatchCode: string;
  status: DispatchStatus;
  district: string;
  missionNotes?: string | null;
  recommendationScore?: number | null;
  recommendationFactors?: Record<string, unknown> | null;
  peopleRescued?: number | null;
  peopleEvacuated?: number | null;
  declineReason?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  teamId: string;
  teamName: string;
  teamType?: string | null;
  teamAvailability?: string | null;
  leaderFullName: string;
  leaderPhone: string;
  leaderEmail?: string | null;
  memberCount: number;
  baseLatitude?: number | null;
  baseLongitude?: number | null;
  baseLocationLabel?: string | null;
  organizationName?: string | null;
  reportId: string;
  reportPublicId: string;
  hazardType: string;
  severityLevel: string;
  landmark?: string | null;
  incidentLat?: number | null;
  incidentLng?: number | null;
  affectedPopulation?: number | null;
  immediateDanger?: boolean | null;
  dispatchedByName?: string | null;
  /** The duty line of the office that tasked the team, when it has one. */
  controlPhone?: string | null;
  events: DispatchEvent[];
}

export interface IncidentDetail extends IncidentSummary {
  verificationNotes?: string | null;
  evidence: EvidenceFile[];
  candidates: TeamCandidate[];
  excluded: ExcludedTeam[];
  dispatches: DispatchRoll[];
}

export interface RecommendationResponse {
  incident: IncidentSummary;
  recommendedTeamId: string | null;
  candidates: TeamCandidate[];
  excluded: ExcludedTeam[];
  notes: string[];
  searchedRadiusKm: number;
}

export interface LeaderWorkspace {
  team: { id: string; name: string; availability: string };
  active: DispatchRoll | null;
  history: DispatchRoll[];
  nextStatuses: DispatchStatus[];
}

export class DispatchApiError extends Error {
  readonly status: number | null;
  readonly fields: Record<string, string>;

  constructor(
    message: string,
    status: number | null,
    fields: Record<string, string> = {}
  ) {
    super(message);
    this.name = "DispatchApiError";
    this.status = status;
    this.fields = fields;
  }
}

function toError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new DispatchApiError(
        "Cannot reach the server. Check that the backend is running and try again.",
        null
      );
    }

    const body = error.response.data as {
      message?: string;
      errors?: Record<string, string>;
    };

    return new DispatchApiError(
      body?.message || "The dispatch board could not be loaded.",
      error.response.status,
      body?.errors ?? {}
    );
  }

  return error instanceof Error ? error : new Error("Something went wrong.");
}

function headersFor(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Verified incidents only, and only inside the signed-in officer's district. */
export async function fetchIncidents(token: string): Promise<IncidentSummary[]> {
  try {
    const { data } = await api.get("/rescue-dispatch/incidents", {
      headers: headersFor(token),
    });

    return (data.incidents ?? []) as IncidentSummary[];
  } catch (error) {
    throw toError(error);
  }
}

/** One incident with its photos, its map point, the ranked teams and its missions. */
export async function fetchIncident(
  token: string,
  reportIdentifier: string
): Promise<IncidentDetail> {
  try {
    const { data } = await api.get(
      `/rescue-dispatch/incidents/${reportIdentifier}`,
      { headers: headersFor(token) }
    );

    return data.incident as IncidentDetail;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * The district takes a verified incident onto its own desk. Not a verification —
 * the DMC officer already decided the report is true. The note is the handover
 * line the next shift reads, and it is optional.
 */
export async function acceptIncident(
  token: string,
  reportIdentifier: string,
  note?: string
): Promise<IncidentSummary> {
  try {
    const { data } = await api.post(
      `/rescue-dispatch/incidents/${reportIdentifier}/accept`,
      note ? { note } : {},
      { headers: headersFor(token) }
    );

    return data.incident as IncidentSummary;
  } catch (error) {
    throw toError(error);
  }
}

export interface DispatchPayload {
  teamId: string;
  missionNotes?: string;
  recommendationScore?: number;
  recommendationFactors?: Record<string, unknown>;
}

export async function dispatchTeam(
  token: string,
  reportIdentifier: string,
  payload: DispatchPayload
): Promise<DispatchRoll> {
  try {
    const { data } = await api.post(
      `/rescue-dispatch/incidents/${reportIdentifier}/dispatch`,
      payload,
      { headers: headersFor(token) }
    );

    return data.dispatch as DispatchRoll;
  } catch (error) {
    throw toError(error);
  }
}

export async function fetchOperations(
  token: string,
  includeClosed: boolean
): Promise<DispatchRoll[]> {
  try {
    const { data } = await api.get("/rescue-dispatch/dispatches", {
      params: { status: includeClosed ? "all" : "active" },
      headers: headersFor(token),
    });

    return (data.dispatches ?? []) as DispatchRoll[];
  } catch (error) {
    throw toError(error);
  }
}

export async function cancelMission(
  token: string,
  dispatchId: string,
  reason?: string
): Promise<DispatchRoll> {
  try {
    const { data } = await api.post(
      `/rescue-dispatch/dispatches/${dispatchId}/cancel`,
      { reason },
      { headers: headersFor(token) }
    );

    return data.dispatch as DispatchRoll;
  } catch (error) {
    throw toError(error);
  }
}

/** The team leader's own board: the live mission, the history and the legal next stages. */
export async function fetchMyMission(token: string): Promise<LeaderWorkspace> {
  try {
    const { data } = await api.get("/rescue-dispatch/mine", {
      headers: headersFor(token),
    });

    return {
      team: data.team,
      active: data.active ?? null,
      history: data.history ?? [],
      nextStatuses: data.nextStatuses ?? [],
    } as LeaderWorkspace;
  } catch (error) {
    throw toError(error);
  }
}

export interface StageUpdatePayload {
  status: DispatchStatus;
  note?: string;
  peopleRescued?: number;
  peopleEvacuated?: number;
}

/**
 * A leader advances their own mission. The dispatch id is optional because the
 * team can only hold one live mission, so the server resolves it from the login.
 */
export async function updateMissionStage(
  token: string,
  dispatchId: string | null | undefined,
  payload: StageUpdatePayload
): Promise<DispatchRoll> {
  try {
    const { data } = await api.post(
      `/rescue-dispatch/dispatches/${dispatchId ?? "current"}/status`,
      payload,
      { headers: headersFor(token) }
    );

    return data.dispatch as DispatchRoll;
  } catch (error) {
    throw toError(error);
  }
}
