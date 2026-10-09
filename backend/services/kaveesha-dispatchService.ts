import crypto from "crypto";

import {
  type DispatchRoll,
  type DispatchStatus,
  type IncidentDetail,
  type IncidentSummary,
  type RescueDispatch,
  CLOSED_DISPATCH_STATUSES,
  DISPATCH_STATUSES,
  allowedNextStatuses,
  isLiveDispatch,
} from "../models/kaveesha-rescueDispatch";
import {
  advanceDispatchStatus,
  countClosedMissionsSince,
  findDispatchById,
  findDispatchRoll,
  findIncident,
  findLiveDispatchForTeam,
  findTeamByUserId,
  findTeamForDispatch,
  hasLiveDispatchForTeamOnReport,
  insertDispatch,
  listDispatchRollsByIncident,
  listDispatchRollsByTeam,
  listDispatchRollsForOfficer,
  listEvidence,
  listVerifiedIncidents,
  recordAcceptance,
  recordClosure,
  recordOutcome,
  releaseTeamIfIdle,
  clearClosure,
} from "../repositories/kaveesha-dispatchRepository";
import {
  type Recommendation,
  recommendTeams,
} from "./kaveesha-teamRecommendationService";
import {
  notifyLeaderOfStandDown,
  notifyLeaderOfTasking,
} from "./kaveesha-leaderPushService";
import { publishDispatchEvent } from "./kaveesha-dispatchEvents";
import type { PushOutcome } from "./kaveesha-leaderPushService";
import { findOfficerAssignment } from "../repositories/kaveesha-rescueTeamRepository";
import { ApiError } from "../utils/apiError";

/* ------------------------------------------------------------------ *
 * Rescue dispatch (UC-03).
 *
 * A verified ground report is the incident; this owns the tasking of a team
 * onto it. Nothing here re-writes the verification tables.
 * ------------------------------------------------------------------ */

/** How far from the incident to look for teams before falling back to district. */
const SEARCH_RADIUS_KM = 60;

/** Missions closed in this window still count as recent workload. */
const WORKLOAD_LOOKBACK_DAYS = 1;

export interface OfficerContext {
  userId: string;
  role: string;
  fullName: string;
  /** Null for a DMC duty officer, who is not tied to one district. */
  district: string | null;
}

/**
 * The officer's district is read from their assignment, never from the request,
 * because this value is what decides which incidents they may task. The token
 * carries no name, so the display name comes from the same row.
 */
export async function buildOfficerContext(
  userId: string,
  role: string
): Promise<OfficerContext> {
  const assignment = await findOfficerAssignment(userId);
  const district = assignment?.district?.trim();

  return {
    userId,
    role,
    fullName: assignment?.full_name ?? "District control room",
    district: district ? district : null,
  };
}

export async function listIncidents(
  context: OfficerContext,
  requestedDistrict?: string
): Promise<IncidentSummary[]> {
  // A district officer stays on their own district; only an unassigned DMC duty
  // officer may narrow or widen the view with ?district=.
  const scope = context.district ?? requestedDistrict?.trim() ?? undefined;

  return listVerifiedIncidents(scope);
}

export async function incidentDetail(
  context: OfficerContext,
  identifier: string
): Promise<IncidentDetail> {
  const incident = await findIncident(identifier);

  if (!incident) {
    throw new ApiError(404, "That incident is not in the verified list.");
  }

  assertIncidentInScope(context, incident.locationDistrict);

  const [evidence, dispatches, recommendation] = await Promise.all([
    listEvidence(incident.id),
    listDispatchRollsByIncident(incident.id),
    recommendForIncident(incident),
  ]);

  return {
    ...incident,
    verificationNotes: undefined,
    evidence,
    candidates: recommendation.candidates,
    excluded: recommendation.excluded,
    dispatches,
  };
}

/**
 * The district takes a verified incident onto its own books.
 *
 * This is not the verification decision — that gate belongs to the DMC officer's
 * queue and is never reopened here. It is the district saying "we are working
 * this" before a team is tasked, so re-accepting is harmless: the first stamp
 * stands and only the handover note is corrected.
 */
export async function acceptIncident(
  context: OfficerContext,
  identifier: string,
  handoverNote?: string
): Promise<IncidentSummary> {
  const incident = await findIncident(identifier);

  if (!incident) {
    throw new ApiError(404, "Only a verified incident can be accepted by a district.");
  }

  assertIncidentInScope(context, incident.locationDistrict);

  await recordAcceptance(incident.id, context.userId, trim(handoverNote));

  // Read the roll back instead of describing what was just written, so the desk
  // shows the acceptance exactly as the next officer will see it.
  const accepted = await findIncident(incident.id);

  if (!accepted) {
    throw new ApiError(500, "The acceptance was saved but could not be read back.");
  }

  publishDispatchEvent({
    kind: "incident",
    district: accepted.locationDistrict,
    reportId: accepted.reportId,
    message: `${accepted.reportId} taken on by ${accepted.locationDistrict}${
      accepted.acceptedByName ? ` (${accepted.acceptedByName})` : ""
    }.`,
  });

  return accepted;
}

/**
 * The district closes an incident it has finished with.
 *
 * A team still on the road makes this impossible, because "closed" would then
 * contradict a live mission — and the officer standing the team down is the same
 * person who has to close the incident, so the two always agree. An incident with
 * no mission ever tasked can still be closed, but only with a reason written
 * down: nothing went, and the desk has to say why later.
 */
export async function closeIncident(
  context: OfficerContext,
  identifier: string,
  resolutionNote?: string
): Promise<IncidentSummary> {
  const incident = await findIncident(identifier);

  if (!incident) {
    throw new ApiError(404, "Only a verified incident can be closed.");
  }

  assertIncidentInScope(context, incident.locationDistrict);

  if (incident.resolvedAt) {
    throw new ApiError(
      409,
      `${incident.reportId} was already closed at ${incident.resolvedAt.toISOString()}${
        incident.resolvedByName ? ` by ${incident.resolvedByName}` : ""
      }.`
    );
  }

  if (!incident.acceptedAt) {
    throw new ApiError(
      409,
      `${incident.reportId} has not been taken on by ${incident.locationDistrict} yet. Accept it first, or leave it for the DMC desk to route.`
    );
  }

  if (incident.liveDispatchCount > 0) {
    throw new ApiError(
      409,
      `${incident.liveDispatchCount} mission${
        incident.liveDispatchCount === 1 ? " is" : "s are"
      } still running on ${incident.reportId}. Stand every team down before the incident is closed.`
    );
  }

  const note = trim(resolutionNote);

  if (incident.dispatchCount === 0 && !note) {
    throw new ApiError(
      400,
      "No team was ever sent to this incident. Write the closing note that explains why it is being shut.",
      { note: "Required when no team was tasked." }
    );
  }

  const closed = await recordClosure(incident.id, context.userId, note);

  if (!closed) {
    throw new ApiError(409, `${incident.reportId} was closed by another officer just now.`);
  }

  const finished = await findIncident(incident.id);

  if (!finished) {
    throw new ApiError(500, "The closure was saved but could not be read back.");
  }

  announceIncident(
    finished,
    "CLOSED",
    `${finished.reportId} closed for ${finished.locationDistrict}: ${
      finished.totalRescued
    } rescued, ${finished.totalEvacuated} evacuated.`
  );

  return finished;
}

/**
 * Undo a closure. A mis-click on a finished incident is the one irreversible-looking
 * action on the desk, so it needs a way back — the note is discarded with it,
 * because a closed incident's reasoning has no place on an open one.
 */
export async function reopenIncident(
  context: OfficerContext,
  identifier: string
): Promise<IncidentSummary> {
  const incident = await findIncident(identifier);

  if (!incident) {
    throw new ApiError(404, "Only a verified incident can be reopened.");
  }

  assertIncidentInScope(context, incident.locationDistrict);

  if (!incident.resolvedAt) {
    throw new ApiError(409, `${incident.reportId} is not closed.`);
  }

  const reopened = await clearClosure(incident.id);

  if (!reopened) {
    throw new ApiError(409, `${incident.reportId} was already reopened by another officer.`);
  }

  const current = await findIncident(incident.id);

  if (!current) {
    throw new ApiError(500, "The incident was reopened but could not be read back.");
  }

  announceIncident(
    current,
    "REOPENED",
    `${current.reportId} is back on the ${current.locationDistrict} desk.`
  );

  return current;
}

export async function recommendForIncident(
  incident: IncidentSummary
): Promise<Recommendation> {
  const since = new Date();

  since.setDate(since.getDate() - WORKLOAD_LOOKBACK_DAYS);

  const closed = await countClosedMissionsSince(since);
  const closedByTeam: Record<string, number> = {};

  for (const row of closed) {
    closedByTeam[row.teamId] = row.closed;
  }

  return recommendTeams(incident, closedByTeam, { radiusKm: SEARCH_RADIUS_KM });
}

export interface DispatchRequest {
  incidentIdentifier: string;
  teamId: string;
  missionNotes?: string;
  recommendationScore?: number;
  recommendationFactors?: Record<string, unknown>;
}

/**
 * The officer confirms, the system records. The team is reserved in the same
 * statement the dispatch is created, so it can never be read as AVAILABLE while
 * a mission already holds it.
 */
export async function dispatchTeam(
  context: OfficerContext,
  request: DispatchRequest
): Promise<DispatchRoll> {
  const incident = await findIncident(request.incidentIdentifier);

  if (!incident) {
    throw new ApiError(404, "Only a verified incident can be dispatched to.");
  }

  assertIncidentInScope(context, incident.locationDistrict);

  if (incident.locationLat === undefined || incident.locationLng === undefined) {
    throw new ApiError(
      400,
      "This incident has no saved location, so there is nowhere to send a team."
    );
  }

  const team = await findTeamForDispatch(request.teamId);

  if (!team) {
    throw new ApiError(404, "That rescue team does not exist.");
  }

  if (team.accountStatus !== "ACTIVE") {
    throw new ApiError(
      400,
      `${team.teamName} is ${team.accountStatus} and cannot be tasked.`
    );
  }

  // Checked before availability on purpose: a team holding a mission is already
  // flipped to ON_DEPLOYMENT, and "already on a live mission" is the truer answer.
  if (team.liveDispatches > 0) {
    throw new ApiError(
      409,
      `${team.teamName} is already on a live mission. Choose another team, or stand that one down first.`
    );
  }

  if (team.availability !== "AVAILABLE") {
    throw new ApiError(
      400,
      `${team.teamName} is marked ${team.availability.replace(
        "_",
        " "
      ).toLowerCase()} and cannot be tasked.`
    );
  }

  if (await hasLiveDispatchForTeamOnReport(incident.id, team.id)) {
    throw new ApiError(409, `${team.teamName} is already assigned to this incident.`);
  }

  const created = await insertDispatch({
    dispatchCode: nextDispatchCode(),
    reportId: incident.id,
    teamId: team.id,
    dispatchedBy: context.userId,
    district: incident.locationDistrict,
    missionNotes: trim(request.missionNotes),
    recommendationScore: request.recommendationScore,
    recommendationFactors: request.recommendationFactors,
  });

  const roll = await findDispatchRoll(created.id);

  if (!roll) {
    throw new ApiError(500, "The dispatch was saved but could not be read back.");
  }

  // The board moves for every officer watching the district, and the leader's
  // phone rings: they are the one person here who is not sitting at a screen.
  announceMission(
    roll,
    `${roll.teamName} tasked to ${roll.reportPublicId} as ${roll.dispatchCode}.`
  );
  pushWhisper(notifyLeaderOfTasking(roll), "tasking notification");

  return roll;
}

export async function cancelDispatch(
  context: OfficerContext,
  dispatchId: string,
  reason?: string
): Promise<DispatchRoll> {
  const dispatch = await requireDispatch(dispatchId);

  assertIncidentInScope(context, dispatch.district);

  if (!isLiveDispatch(dispatch.status)) {
    throw new ApiError(
      409,
      `Mission ${dispatch.dispatchCode} is already ${dispatch.status.toLowerCase()}.`
    );
  }

  const note = trim(reason);
  const roll = await moveToStatus(dispatch.id, "CANCELLED", context, note);

  // The team is out on the road and cannot see the portal: this is the message
  // that turns them around, so it goes to the handset with the reason attached.
  pushWhisper(
    notifyLeaderOfStandDown(roll, note ?? undefined),
    "stand-down notification"
  );

  return roll;
}

export interface LeaderAction {
  userId: string;
  role: string;
  dispatchId?: string;
  status: DispatchStatus;
  note?: string;
  peopleRescued?: number;
  peopleEvacuated?: number;
}

/**
 * A leader acts only on their own team's mission, and only forward along the
 * machine. Which team they are is resolved from their login, never from the body.
 */
export async function advanceByLeader(action: LeaderAction): Promise<DispatchRoll> {
  const team = await findTeamByUserId(action.userId);

  if (!team) {
    throw new ApiError(404, "No rescue team is attached to this account yet.");
  }

  const dispatch = action.dispatchId
    ? await requireDispatch(action.dispatchId)
    : await findLiveDispatchForTeam(team.teamId);

  if (!dispatch) {
    throw new ApiError(404, "This team has no live mission to update.");
  }

  if (dispatch.teamId !== team.teamId) {
    throw new ApiError(
      403,
      "That mission belongs to another team. A leader account acts only on its own."
    );
  }

  const legal = allowedNextStatuses(dispatch.status, "LEADER");

  if (!legal.includes(action.status)) {
    throw new ApiError(
      409,
      legal.length === 0
        ? `Mission ${dispatch.dispatchCode} is already ${dispatch.status.toLowerCase()}.`
        : `A team cannot move a mission from ${dispatch.status} to ${action.status}. The next step is one of: ${legal.join(", ")}.`
    );
  }

  return moveToStatus(dispatch.id, action.status, action, trim(action.note), {
    peopleRescued: action.peopleRescued,
    peopleEvacuated: action.peopleEvacuated,
  });
}

export interface LeaderWorkspace {
  team: { id: string; name: string; availability: string };
  active: DispatchRoll | null;
  history: DispatchRoll[];
  nextStatuses: DispatchStatus[];
}

export async function leaderWorkspace(userId: string): Promise<LeaderWorkspace> {
  const team = await findTeamByUserId(userId);

  if (!team) {
    throw new ApiError(404, "No rescue team is attached to this account yet.");
  }

  const rolls = await listDispatchRollsByTeam(team.teamId);
  const active = rolls.find((roll) => isLiveDispatch(roll.status)) ?? null;

  return {
    team: { id: team.teamId, name: team.teamName, availability: team.availability },
    active,
    history: rolls.filter((roll) => !isLiveDispatch(roll.status)).slice(0, 10),
    nextStatuses: active ? allowedNextStatuses(active.status, "LEADER") : [],
  };
}

export async function officerOperations(
  context: OfficerContext,
  liveOnly: boolean
): Promise<DispatchRoll[]> {
  return listDispatchRollsForOfficer(context.district, liveOnly);
}

/** The stage names, so neither portal nor citizen app hardcodes its own list. */
export function dispatchStatusCatalog(): DispatchStatus[] {
  return [...DISPATCH_STATUSES];
}

async function moveToStatus(
  dispatchId: string,
  status: DispatchStatus,
  actor: { userId: string; role: string },
  note?: string,
  outcome?: { peopleRescued?: number; peopleEvacuated?: number }
): Promise<DispatchRoll> {
  const advanced = await advanceDispatchStatus(
    dispatchId,
    status,
    { userId: actor.userId, role: actor.role },
    note
  );

  if (!advanced.dispatch) {
    throw new ApiError(404, "That mission is no longer on the board.");
  }

  if (status === "COMPLETED" && outcome) {
    await recordOutcome(dispatchId, outcome);
  }

  // A team is only handed back when it holds no other live mission.
  if (CLOSED_DISPATCH_STATUSES.includes(status)) {
    await releaseTeamIfIdle(advanced.dispatch.teamId, dispatchId);
  }

  const roll = await findDispatchRoll(dispatchId);

  if (!roll) {
    throw new ApiError(500, "The stage was saved but could not be read back.");
  }

  // Every stage a leader taps on a phone lands here, which is what makes the
  // officer's board move the second it happens instead of on the next poll.
  announceMission(
    roll,
    `${roll.teamName} · ${roll.dispatchCode} is now ${roll.status.toLowerCase().replace(/_/g, " ")}.`
  );

  return roll;
}

async function requireDispatch(dispatchId: string): Promise<RescueDispatch> {
  const dispatch = await findDispatchById(dispatchId);

  if (!dispatch) {
    throw new ApiError(404, "No mission with that reference.");
  }

  return dispatch;
}

function assertIncidentInScope(context: OfficerContext, district: string): void {
  if (context.district === null) return;

  if (context.district !== district) {
    throw new ApiError(
      403,
      `That incident is in ${district}, and your office covers ${context.district}. A DMC duty officer can task across districts.`
    );
  }
}

/**
 * Announce something that is already committed.
 *
 * The live feed and the handset are both best effort by design: the write is
 * safe in the database, the board polls anyway, and a notification layer that
 * can fail a dispatch would turn a dead gateway into a stuck rescue.
 */
function announceMission(roll: DispatchRoll, message: string): void {
  publishDispatchEvent({
    kind: "dispatch",
    district: roll.district,
    reportId: roll.reportPublicId,
    dispatchCode: roll.dispatchCode,
    teamName: roll.teamName,
    status: roll.status,
    message,
  });
}

function announceIncident(
  incident: IncidentSummary,
  status: "CLOSED" | "REOPENED",
  message: string
): void {
  publishDispatchEvent({
    kind: "incident",
    district: incident.locationDistrict,
    reportId: incident.reportId,
    status,
    message,
  });
}

/** Only the outcomes worth an operator's attention are printed. */
function pushWhisper(
  attempt: Promise<PushOutcome>,
  label: string
): void {
  attempt
    .then((outcome) => {
      if (outcome === "sent" || outcome === "no-token" || outcome === "disabled") {
        return;
      }

      console.warn(`[dispatch-push] ${label}: ${outcome}`);
    })
    .catch((error: unknown) => {
      console.warn(
        `[dispatch-push] ${label}: ${(error as Error)?.message ?? "unknown error"}`
      );
    });
}

/** DSP-261009-3F2A9C: readable over the phone, unique enough for a district. */
function nextDispatchCode(): string {
  const now = new Date();
  const stamp = [
    String(now.getFullYear()).slice(2),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join("");

  return `DSP-${stamp}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function trim(value: string | undefined): string | undefined {
  const cleaned = (value ?? "").trim();

  return cleaned === "" ? undefined : cleaned;
}
