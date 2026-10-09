import type { EvidenceAttachment } from "./amasha-hazardReportExt";

/* ------------------------------------------------------------------ *
 * Rescue dispatch (Member 3, step 1).
 *
 * A verified hazard report is the incident; nothing here duplicates it.
 * The dispatch row is the tasking, and the event rows are the audit
 * trail that the portal timeline and the real-time feed both read.
 * ------------------------------------------------------------------ */

export const DISPATCH_STATUSES = [
  "DISPATCHED",
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "RESCUE_IN_PROGRESS",
  "RETURNING",
  "COMPLETED",
  "DECLINED",
  "CANCELLED",
] as const;

export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

/**
 * Stages that still hold the team. The database enforces one live dispatch per
 * team with a partial unique index, so these two lists must stay in step with
 * the migration.
 */
export const LIVE_DISPATCH_STATUSES: DispatchStatus[] = [
  "DISPATCHED",
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "RESCUE_IN_PROGRESS",
  "RETURNING",
];

export const CLOSED_DISPATCH_STATUSES: DispatchStatus[] = [
  "COMPLETED",
  "DECLINED",
  "CANCELLED",
];

/**
 * The mission path a team leader drives forward. Skipping ahead is allowed only
 * where a real job can legitimately end early (blocked access, nothing to
 * rescue); going backwards is always refused.
 */
const LEADER_TRANSITIONS: Record<DispatchStatus, DispatchStatus[]> = {
  DISPATCHED: ["ACCEPTED", "DECLINED"],
  ACCEPTED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["ARRIVED", "COMPLETED", "CANCELLED"],
  ARRIVED: ["RESCUE_IN_PROGRESS", "RETURNING", "COMPLETED", "CANCELLED"],
  RESCUE_IN_PROGRESS: ["RETURNING", "COMPLETED", "CANCELLED"],
  RETURNING: ["COMPLETED"],
  COMPLETED: [],
  DECLINED: [],
  CANCELLED: [],
};

/** The officer may stand a mission down while it is still live. */
const OFFICER_TRANSITIONS: Record<DispatchStatus, DispatchStatus[]> = {
  DISPATCHED: ["CANCELLED", "DECLINED"],
  ACCEPTED: ["CANCELLED"],
  EN_ROUTE: ["CANCELLED"],
  ARRIVED: ["CANCELLED"],
  RESCUE_IN_PROGRESS: ["CANCELLED"],
  RETURNING: ["CANCELLED"],
  COMPLETED: [],
  DECLINED: [],
  CANCELLED: [],
};

export function liveDispatchStatuses(): DispatchStatus[] {
  return [...LIVE_DISPATCH_STATUSES];
}

export function allowedNextStatuses(
  from: DispatchStatus,
  actor: "LEADER" | "OFFICER"
): DispatchStatus[] {
  return actor === "LEADER"
    ? [...(LEADER_TRANSITIONS[from] ?? [])]
    : [...(OFFICER_TRANSITIONS[from] ?? [])];
}

export function isLiveDispatch(status: DispatchStatus): boolean {
  return LIVE_DISPATCH_STATUSES.includes(status);
}

/** One row per recorded stage change, newest last. */
export interface DispatchEvent {
  id: string;
  /** Filled only on the way in; the roll reads its events through the parent. */
  dispatchId?: string;
  fromStatus: DispatchStatus | null;
  toStatus: DispatchStatus;
  actorId?: string;
  actorRole?: string;
  /** Joined from the users table: a trail row that cannot say who did it is useless. */
  actorName?: string;
  note?: string;
  createdAt: Date;
}

export interface RescueDispatch {
  id: string;
  dispatchCode: string;
  reportId: string;
  teamId: string;
  dispatchedBy?: string;
  district: string;
  status: DispatchStatus;
  missionNotes?: string;
  recommendationScore?: number;
  recommendationFactors?: Record<string, unknown>;
  peopleRescued?: number;
  peopleEvacuated?: number;
  declineReason?: string;
  cancelReason?: string;
  acceptedAt?: Date;
  enRouteAt?: Date;
  arrivedAt?: Date;
  rescueStartedAt?: Date;
  completedAt?: Date;
  returnedAt?: Date;
  declinedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** What the officer reads before dispatching: an incident, not a report row. */
export interface IncidentSummary {
  id: string;
  reportId: string;
  hazardType: string;
  severityLevel: string;
  locationDistrict: string;
  locationLat?: number;
  locationLng?: number;
  landmark?: string;
  description: string;
  affectedPopulation?: number;
  immediateDanger: boolean;
  observedAt?: Date;
  verifiedAt?: Date;
  verifiedByName?: string;
  reporterName?: string;
  reporterPhone?: string;
  photoCount: number;
  /** The first photo's data URL, so a list can show the scene without another read. */
  thumbnailUrl?: string;
  liveDispatchCount: number;
  /** Every mission this incident has ever had, closed ones included. */
  dispatchCount: number;
  /**
   * The district office has taken the incident on. Verification says a report is
   * true; this says a district is working it, and it lives in its own table.
   */
  acceptedAt?: Date;
  acceptedByName?: string;
  handoverNote?: string;
}

export interface IncidentDetail extends IncidentSummary {
  evidence: EvidenceAttachment[];
  verificationNotes?: string;
  candidates: TeamCandidate[];
  excluded: ExcludedTeam[];
  dispatches: DispatchRoll[];
}

/** A dispatch with the team and incident snapshot the portal lists need. */
export interface DispatchRoll {
  id: string;
  dispatchCode: string;
  status: DispatchStatus;
  district: string;
  missionNotes?: string;
  recommendationScore?: number;
  recommendationFactors?: Record<string, unknown>;
  peopleRescued?: number;
  peopleEvacuated?: number;
  declineReason?: string;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
  teamId: string;
  teamName: string;
  teamType?: string;
  teamAvailability?: string;
  leaderFullName: string;
  leaderPhone: string;
  leaderEmail?: string;
  memberCount: number;
  baseLatitude?: number;
  baseLongitude?: number;
  baseLocationLabel?: string;
  organizationName?: string;
  reportId: string;
  reportPublicId: string;
  hazardType: string;
  severityLevel: string;
  landmark?: string;
  incidentLat?: number;
  incidentLng?: number;
  affectedPopulation?: number;
  immediateDanger?: boolean;
  dispatchedByName?: string;
  /** The duty line of the officer who tasked the team, when they have one. */
  controlPhone?: string;
  events: DispatchEvent[];
}

/** One ranked team, with the reasons kept next to the number. */
export interface TeamCandidate {
  teamId: string;
  teamName: string;
  teamType?: string;
  affiliation: string;
  organizationName?: string;
  district: string;
  outsideDistrict: boolean;
  availability: string;
  leaderFullName: string;
  leaderPhone: string;
  leaderDesignation?: string;
  teamContactNumber?: string;
  memberCount: number;
  capabilities: string[];
  equipment: string[];
  baseLatitude?: number;
  baseLongitude?: number;
  baseLocationLabel?: string;
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

/** Teams the officer can see but should not be offered, and why. */
export interface ExcludedTeam {
  teamId: string;
  teamName: string;
  teamType?: string;
  district: string;
  availability: string;
  reason: string;
}
