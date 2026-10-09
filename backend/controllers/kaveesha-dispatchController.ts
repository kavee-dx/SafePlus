import type { Request, Response } from "express";

import {
  type LeaderAction,
  acceptIncident,
  advanceByLeader,
  buildOfficerContext,
  cancelDispatch,
  closeIncident,
  dispatchStatusCatalog,
  dispatchTeam,
  incidentDetail,
  leaderWorkspace,
  listIncidents,
  officerOperations,
  recommendForIncident,
  reopenIncident,
} from "../services/kaveesha-dispatchService";
import { subscribeDispatchEvents } from "../services/kaveesha-dispatchEvents";
import { findIncident } from "../repositories/kaveesha-dispatchRepository";
import {
  validateAcceptance,
  validateClosure,
  validateDispatch,
  validateReason,
  validateStatus,
} from "../validators/kaveesha-dispatchValidators";
import { ApiError } from "../utils/apiError";

/**
 * UC-03 endpoints. Officers task a team and may stand a mission down; a team
 * leader only ever moves their own mission forward. Which district a caller owns
 * is resolved from their assignment, never from the request.
 */

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function actor(req: Request): { userId: string; role: string } {
  if (!req.user) {
    throw new ApiError(401, "Authentication required.");
  }

  return { userId: req.user.sub, role: req.user.role };
}

/** GET /api/rescue-dispatch/incidents */
export async function incidents(req: Request, res: Response): Promise<void> {
  const context = await buildOfficerContext(req.user!.sub, req.user!.role);
  const district = req.query.district ? String(req.query.district) : undefined;

  res.json({
    message:
      context.district
        ? `Verified incidents for ${context.district} District.`
        : "Verified incidents for every district.",
    incidents: await listIncidents(context, district),
  });
}

/** GET /api/rescue-dispatch/incidents/:reportId */
export async function incident(req: Request, res: Response): Promise<void> {
  const context = await buildOfficerContext(req.user!.sub, req.user!.role);

  res.json({
    incident: await incidentDetail(context, param(req.params.reportId)),
  });
}

/** POST /api/rescue-dispatch/incidents/:reportId/accept */
export async function accept(req: Request, res: Response): Promise<void> {
  const context = await buildOfficerContext(req.user!.sub, req.user!.role);
  const { note } = validateAcceptance(req.body);

  const incident = await acceptIncident(
    context,
    param(req.params.reportId),
    note
  );

  res.json({
    message: `${incident.reportId} is on the ${incident.locationDistrict} desk now${
      incident.acceptedByName ? `, taken on by ${incident.acceptedByName}` : ""
    }.`,
    incident,
  });
}

/**
 * GET /api/rescue-dispatch/incidents/:reportId/recommendations
 * The ranking alone, for the officer who is still deciding.
 */
export async function recommendations(req: Request, res: Response): Promise<void> {
  const context = await buildOfficerContext(req.user!.sub, req.user!.role);
  const incident = await findIncident(param(req.params.reportId));

  if (!incident) {
    throw new ApiError(404, "That incident is not in the verified list.");
  }

  if (context.district && incident.locationDistrict !== context.district) {
    throw new ApiError(
      403,
      `That incident is in ${incident.locationDistrict}, and your office covers ${context.district}.`
    );
  }

  const recommendation = await recommendForIncident(incident);

  res.json({
    incident,
    recommendedTeamId: recommendation.recommendedTeamId ?? null,
    candidates: recommendation.candidates,
    excluded: recommendation.excluded,
    notes: recommendation.notes,
    searchedRadiusKm: recommendation.searchedRadiusKm,
  });
}

/** POST /api/rescue-dispatch/incidents/:reportId/dispatch */
export async function dispatch(req: Request, res: Response): Promise<void> {
  const context = await buildOfficerContext(req.user!.sub, req.user!.role);
  const payload = validateDispatch(req.body);

  const roll = await dispatchTeam(context, {
    incidentIdentifier: param(req.params.reportId),
    ...payload,
  });

  res.status(201).json({
    message: `${roll.teamName} has been tasked to ${roll.reportPublicId} as ${roll.dispatchCode}.`,
    dispatch: roll,
  });
}

/** GET /api/rescue-dispatch/dispatches */
export async function dispatches(req: Request, res: Response): Promise<void> {
  const context = await buildOfficerContext(req.user!.sub, req.user!.role);
  const liveOnly = String(req.query.status ?? "active").toLowerCase() !== "all";

  res.json({
    message: liveOnly
      ? "Missions still running."
      : "Missions running and closed.",
    dispatches: await officerOperations(context, liveOnly),
  });
}

/** POST /api/rescue-dispatch/dispatches/:id/cancel */
export async function cancel(req: Request, res: Response): Promise<void> {
  const context = await buildOfficerContext(req.user!.sub, req.user!.role);
  const { reason } = validateReason(req.body);

  const roll = await cancelDispatch(context, param(req.params.id), reason);

  res.json({
    message: `Mission ${roll.dispatchCode} is stood down.`,
    dispatch: roll,
  });
}

/** POST /api/rescue-dispatch/incidents/:reportId/close */
export async function close(req: Request, res: Response): Promise<void> {
  const context = await buildOfficerContext(req.user!.sub, req.user!.role);
  const { note } = validateClosure(req.body);

  const incident = await closeIncident(context, param(req.params.reportId), note);

  res.json({
    message: `${incident.reportId} is closed for ${incident.locationDistrict}: ${incident.totalRescued} rescued, ${incident.totalEvacuated} evacuated.`,
    incident,
  });
}

/** POST /api/rescue-dispatch/incidents/:reportId/reopen */
export async function reopen(req: Request, res: Response): Promise<void> {
  const context = await buildOfficerContext(req.user!.sub, req.user!.role);
  const incident = await reopenIncident(context, param(req.params.reportId));

  res.json({
    message: `${incident.reportId} is back on the ${incident.locationDistrict} desk.`,
    incident,
  });
}

/**
 * GET /api/rescue-dispatch/stream
 *
 * A live feed of the officer's own district: every stage a team leader taps on a
 * phone and every closure lands here the moment it is written. Deliberately not
 * a websocket — a plain streamed response needs no new dependency and no new
 * server wiring, and the board still polls as a fallback, so a dropped stream is
 * a slower update rather than a blind control room.
 *
 * The token arrives in the Authorization header, which is why the portal reads
 * this with fetch and its response stream instead of EventSource: an
 * EventSource cannot send a header, and a token in a query string ends up in
 * access logs.
 */
export async function stream(req: Request, res: Response): Promise<void> {
  const context = await buildOfficerContext(req.user!.sub, req.user!.role);

  res.status(200);
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    // nginx must not buffer this, and no proxy may rewrite the chunks.
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  let open = true;

  const write = (payload: unknown): void => {
    if (!open || res.writableEnded) return;

    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const unsubscribe = subscribeDispatchEvents(context.district, (event) =>
    write(event)
  );

  write({
    kind: "hello",
    district: context.district ?? "ALL",
    message: context.district
      ? `Watching ${context.district} District.`
      : "Watching every district.",
    at: new Date().toISOString(),
  });

  // A comment frame every 20s keeps an idle connection alive through any proxy
  // that drops quiet streams, and tells the client the socket is still ours.
  const keepAlive = setInterval(() => {
    if (!open || res.writableEnded) return;

    res.write(": keep-alive\n\n");
  }, 20_000);

  req.on("close", () => {
    open = false;
    clearInterval(keepAlive);
    unsubscribe();
  });
}

/** GET /api/rescue-dispatch/mine — the team leader's assignment board. */
export async function mine(_req: Request, res: Response): Promise<void> {
  const userId = actor(_req).userId;
  const workspace = await leaderWorkspace(userId);

  res.json({
    message: workspace.active
      ? `Mission ${workspace.active.dispatchCode} is yours at ${workspace.active.status}.`
      : "No live mission. Your team is standing by.",
    ...workspace,
  });
}

/** POST /api/rescue-dispatch/dispatches/:id/status — leader advances their own. */
export async function status(req: Request, res: Response): Promise<void> {
  const { userId, role } = actor(req);
  const payload = validateStatus(req.body);
  const reference = param(req.params.id);

  const action: LeaderAction = {
    userId,
    role,
    // "current" is the honest answer when a leader knows their team but not the
    // reference; the team's one live mission is resolved from the login either way.
    dispatchId:
      reference === "" || reference.toLowerCase() === "current"
        ? undefined
        : reference,
    status: payload.status,
    note: payload.note,
    peopleRescued: payload.peopleRescued,
    peopleEvacuated: payload.peopleEvacuated,
  };

  const roll = await advanceByLeader(action);

  res.json({
    message: `${roll.dispatchCode} is now ${roll.status}.`,
    dispatch: roll,
    nextStatuses: roll.status === "COMPLETED" ? [] : undefined,
  });
}

/** GET /api/rescue-dispatch/stages — the catalog, so clients list it, not hardcode it. */
export function stages(_req: Request, res: Response): void {
  res.json({ stages: dispatchStatusCatalog() });
}
