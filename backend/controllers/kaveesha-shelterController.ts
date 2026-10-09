import type { Request, Response } from "express";

import { ApiError } from "../utils/apiError";
import { buildOfficerContext } from "../services/kaveesha-dispatchService";
import { subscribeDispatchEvents } from "../services/kaveesha-dispatchEvents";
import {
  allocateGroup,
  cancelGroupAllocation,
  createGroup,
  createShelterManager,
  editShelter,
  listShelterManagers,
  listShelters,
  nearbyShelters,
  officerGroups,
  recommendShelters,
  registerShelter,
  shelterAnalytics,
  shelterDetail,
  updateShelterManager,
} from "../services/kaveesha-shelterService";
import {
  validateAllocate,
  validateGroupCreate,
  validateManagerCreate,
  validateManagerPatch,
  validateShelterCreate,
  validateShelterPatch,
} from "../validators/kaveesha-shelterValidators";

/* ------------------------------------------------------------------ *
 * Shelter Coordination — the officer desk and the citizen browse.
 *
 * The officer registers shelters, sees who is waiting, allocates them, and
 * creates the Shelter Manager accounts that confirm arrivals. A signed-in
 * citizen gets a read-only, live view of nearby shelters. Which district a
 * caller owns is always read from their assignment, never from the request.
 * ------------------------------------------------------------------ */

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function numQuery(value: unknown): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw !== "string" || raw.trim() === "") return undefined;

  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function textQuery(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;

  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
}

function officer(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required.");
  }

  return buildOfficerContext(req.user.sub, req.user.role);
}

/* ------------------------------ shelters ------------------------------ */

/** GET /api/shelters */
export async function shelters(req: Request, res: Response): Promise<void> {
  const context = await officer(req);
  const district = context.district ?? textQuery(req.query.district);
  const activeOnly = String(req.query.status ?? "active").toLowerCase() !== "all";

  const rolls = await listShelters({ district, activeOnly });

  res.json({ message: "Shelters on the register.", shelters: rolls });
}

/**
 * GET /api/shelters/analytics?district=<name|all> — the officer dashboard.
 * A District Officer may READ any district (or all) to switch the board; the
 * default is their own. Changing anything stays locked to their own district by
 * the write guards in the service, so a read of elsewhere can never edit it.
 */
export async function analytics(req: Request, res: Response): Promise<void> {
  const context = await officer(req);
  const requested = textQuery(req.query.district);

  const district =
    requested === "all" ? null : requested ?? context.district ?? null;

  const data = await shelterAnalytics({ district });

  res.json({ message: "Shelter analytics.", ...data });
}

/** POST /api/shelters */
export async function createShelter(req: Request, res: Response): Promise<void> {
  const context = await officer(req);
  const input = validateShelterCreate(req.body);

  const shelter = await registerShelter(context, input);

  res.status(201).json({
    message: `${shelter.name} is on the ${shelter.district} register with room for ${shelter.maxCapacity}.`,
    shelter,
  });
}

/** GET /api/shelters/:id */
export async function shelter(req: Request, res: Response): Promise<void> {
  const context = await officer(req);
  const detail = await shelterDetail(context, param(req.params.id));

  res.json({ ...detail });
}

/** PATCH /api/shelters/:id */
export async function updateShelter(req: Request, res: Response): Promise<void> {
  const context = await officer(req);
  const patch = validateShelterPatch(req.body);

  const shelter = await editShelter(context, param(req.params.id), patch);

  res.json({ message: `${shelter.name} was updated.`, shelter });
}

/**
 * GET /api/shelters/recommend?lat&lng&people&district
 * The "where do I send them?" answer: nearest suitable shelter, or a split with
 * the shortfall spelled out when nothing nearby can take the whole group.
 */
export async function recommend(req: Request, res: Response): Promise<void> {
  const context = await officer(req);
  const latitude = numQuery(req.query.lat ?? req.query.latitude);
  const longitude = numQuery(req.query.lng ?? req.query.longitude);
  const people = numQuery(req.query.people);

  if (latitude === undefined || longitude === undefined) {
    throw new ApiError(400, "Give a latitude and longitude to recommend from.");
  }

  if (people === undefined || people < 1) {
    throw new ApiError(400, "Say how many people need shelter.");
  }

  const recommendation = await recommendShelters({
    latitude,
    longitude,
    people: Math.trunc(people),
    district: context.district ?? textQuery(req.query.district),
  });

  res.json({ message: "Shelter recommendation.", recommendation });
}

/* --------------------------- evacuee groups --------------------------- */

/** GET /api/shelter-groups */
export async function groups(req: Request, res: Response): Promise<void> {
  const context = await officer(req);
  const openOnly = String(req.query.status ?? "open").toLowerCase() !== "all";

  res.json({
    message: openOnly
      ? "Groups still needing shelter."
      : "Every evacuee group on record.",
    groups: await officerGroups(context, openOnly),
  });
}

/** POST /api/shelter-groups */
export async function createGroupHandler(req: Request, res: Response): Promise<void> {
  const context = await officer(req);
  const input = validateGroupCreate(req.body);

  const group = await createGroup(context, input);

  res.status(201).json({
    message: `Group ${group.groupCode} is waiting for a shelter.`,
    group,
  });
}

/** POST /api/shelter-groups/:id/allocate */
export async function allocate(req: Request, res: Response): Promise<void> {
  const context = await officer(req);
  const { allocations } = validateAllocate(req.body);

  const group = await allocateGroup(context, param(req.params.id), allocations);

  res.json({
    message: `${group.groupCode} is allocated to ${group.allocations.length} shelter${
      group.allocations.length === 1 ? "" : "s"
    }.`,
    group,
  });
}

/** POST /api/shelter-groups/:id/cancel */
export async function cancelAllocation(req: Request, res: Response): Promise<void> {
  const context = await officer(req);
  const group = await cancelGroupAllocation(context, param(req.params.id));

  res.json({ message: `${group.groupCode} is no longer allocated.`, group });
}

/* --------------------------- manager accounts --------------------------- */

/** GET /api/shelter-managers */
export async function managers(req: Request, res: Response): Promise<void> {
  const context = await officer(req);

  res.json({
    message: "Shelter managers on your district.",
    managers: await listShelterManagers(context),
  });
}

/** POST /api/shelter-managers */
export async function createManager(req: Request, res: Response): Promise<void> {
  const context = await officer(req);
  const input = validateManagerCreate(req.body);

  const manager = await createShelterManager(context, input);

  res.status(201).json({
    message: `${manager.fullName} can now sign in to run ${manager.shelters.length} shelter${
      manager.shelters.length === 1 ? "" : "s"
    }.`,
    manager,
  });
}

/** PATCH /api/shelter-managers/:id */
export async function updateManager(req: Request, res: Response): Promise<void> {
  const context = await officer(req);
  const changes = validateManagerPatch(req.body);

  const manager = await updateShelterManager(
    context,
    param(req.params.id),
    changes
  );

  res.json({ message: "The shelter manager was updated.", manager });
}

/* ------------------------------ citizen ------------------------------ */

/**
 * GET /api/shelters/nearby?lat&lng  (or ?district when GPS is lost)
 * A live, read-only list any signed-in citizen can open: each shelter's band plus
 * coordinates, which is exactly what the mobile map needs to draw directions.
 */
export async function citizenNearby(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, "Authentication required.");
  }

  const shelters = await nearbyShelters({
    latitude: numQuery(req.query.lat ?? req.query.latitude),
    longitude: numQuery(req.query.lng ?? req.query.longitude),
    district: textQuery(req.query.district),
  });

  res.json({ message: "Shelters near you.", shelters });
}

/* ------------------------------ live feed ------------------------------ */

/**
 * GET /api/shelters/stream
 * The same district-keyed bus the dispatch board uses, now carrying shelter
 * events, so the shelter desk updates the instant a group is allocated or someone
 * is confirmed in. Deliberately a plain streamed response, for the reasons the
 * dispatch stream already documents (header-based auth, no new dependency).
 */
export async function stream(req: Request, res: Response): Promise<void> {
  const context = await buildOfficerContext(req.user!.sub, req.user!.role);

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

  const unsubscribe = subscribeDispatchEvents(context.district, (event) =>
    write(event)
  );

  write({
    kind: "hello",
    district: context.district ?? "ALL",
    message: context.district
      ? `Watching ${context.district} shelters.`
      : "Watching shelters in every district.",
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
