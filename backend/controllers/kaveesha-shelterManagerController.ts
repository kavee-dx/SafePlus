import type { Request, Response } from "express";

import { ApiError } from "../utils/apiError";
import { subscribeDispatchEvents } from "../services/kaveesha-dispatchEvents";
import {
  confirmArrival,
  managerAnalytics,
  managerExpectedArrivals,
  managerShelters,
  recordDeparture,
  recordWalkIn,
  resolveManagerProfile,
} from "../services/kaveesha-shelterService";
import {
  validateConfirmArrival,
  validateDeparture,
  validateWalkIn,
} from "../validators/kaveesha-shelterValidators";

/* ------------------------------------------------------------------ *
 * Shelter Manager workspace.
 *
 * Everything here is scoped, from the first line, to the shelters assigned to
 * the signed-in manager: their identity comes from the token and their shelter
 * list from their profile, so one manager can never confirm an arrival or move
 * occupancy at a shelter they do not run.
 * ------------------------------------------------------------------ */

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function managerId(req: Request): string {
  if (!req.user) {
    throw new ApiError(401, "Authentication required.");
  }

  return req.user.sub;
}

/** GET /api/shelter-manager/profile — the manager and their assigned shelters. */
export async function profile(req: Request, res: Response): Promise<void> {
  const manager = await resolveManagerProfile(managerId(req));

  res.json({ message: "Your shelter assignment.", manager });
}

/**
 * GET /api/shelter-manager/analytics — the manager's own dashboard figures
 * (24h occupancy, capacity split, status board) for the shelters they run.
 */
export async function analytics(req: Request, res: Response): Promise<void> {
  const data = await managerAnalytics(managerId(req));

  res.json({ message: "Your shelter analytics.", ...data });
}

/** GET /api/shelter-manager/shelters — live capacity for the shelters you run. */
export async function shelters(req: Request, res: Response): Promise<void> {
  res.json({
    message: "Shelters assigned to you.",
    shelters: await managerShelters(managerId(req)),
  });
}

/** GET /api/shelter-manager/expected-arrivals — reservations still inbound. */
export async function expectedArrivals(req: Request, res: Response): Promise<void> {
  res.json({
    message: "Groups expected at your shelters.",
    arrivals: await managerExpectedArrivals(managerId(req)),
  });
}

/** POST /api/shelter-manager/allocations/:id/confirm-arrival */
export async function confirm(req: Request, res: Response): Promise<void> {
  const { arrivedCount, discrepancyNote } = validateConfirmArrival(req.body);

  const result = await confirmArrival(
    managerId(req),
    param(req.params.id),
    arrivedCount,
    discrepancyNote
  );

  res.json({
    message: `${arrivedCount} arrived. ${result.shelter.name} now holds ${result.shelter.confirmedOccupancy}.`,
    ...result,
  });
}

/** POST /api/shelter-manager/shelters/:id/walk-in */
export async function walkIn(req: Request, res: Response): Promise<void> {
  const { people, vulnerable } = validateWalkIn(req.body);

  const result = await recordWalkIn(
    managerId(req),
    param(req.params.id),
    people,
    vulnerable
  );

  res.status(201).json({
    message: `Logged ${people} walk-in${people === 1 ? "" : "s"}. ${result.shelter.name} now holds ${result.shelter.confirmedOccupancy}.`,
    ...result,
  });
}

/** POST /api/shelter-manager/shelters/:id/departure */
export async function departure(req: Request, res: Response): Promise<void> {
  const { people, reason } = validateDeparture(req.body);

  const shelter = await recordDeparture(
    managerId(req),
    param(req.params.id),
    people,
    reason
  );

  res.json({
    message: `Logged ${people} departing. ${shelter.name} now holds ${shelter.confirmedOccupancy}.`,
    shelter,
  });
}

/**
 * GET /api/shelter-manager/stream
 * The same district-keyed bus the officer desk uses, but scoped to the manager's
 * own district as recorded on their profile — never a district read from the
 * request — so the dashboard updates the instant someone is allocated to, or
 * confirmed at, a shelter they run. A deliberate plain streamed response, for the
 * reasons the dispatch stream already documents (header-based auth).
 */
export async function stream(req: Request, res: Response): Promise<void> {
  const manager = await resolveManagerProfile(managerId(req));

  res.status(200);
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
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

  const unsubscribe = subscribeDispatchEvents(manager.district, (event) =>
    write(event)
  );

  write({
    kind: "hello",
    district: manager.district,
    message: `Watching ${manager.district} shelters.`,
    at: new Date().toISOString(),
  });

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
