import { randomUUID } from "node:crypto";

import bcrypt from "bcrypt";

import pool from "../config/db";
import { ApiError } from "../utils/apiError";
import type { OfficerContext } from "./kaveesha-dispatchService";
import { publishDispatchEvent } from "./kaveesha-dispatchEvents";
import {
  insertUser,
  withTransaction,
} from "../repositories/registrationRepository";
import type { NewUser } from "../models/registration";
import type { DispatchRoll } from "../models/kaveesha-rescueDispatch";
import type {
  EvacueeGroup,
  OccupancyTrendPoint,
  ShelterAnalytics,
  ShelterAnalyticsRow,
  ShelterBand,
  ShelterManager,
  ShelterRoll,
  ShelterStatus,
} from "../models/kaveesha-shelter";
import {
  type NewShelterInput,
  type ShelterPatch,
  analyticsShelters,
  assignManagerShelters,
  cancelPendingForGroup,
  confirmAllocationArrival,
  createShelter,
  districtsWithShelters,
  findAllocation,
  findGroup,
  findManagerByUserId,
  findShelter,
  groupExistsForDispatch,
  insertAllocation,
  insertEvent,
  insertGroup,
  insertManager,
  listEvents,
  listExpectedArrivals,
  listGroups,
  listManagers,
  lockShelterCapacity,
  occupancyTrend,
  rollupGroupAllocations,
  searchShelters,
  setGroupStatus,
  setManagerStatus,
  updateShelter,
} from "../repositories/kaveesha-shelterRepository";

/* ------------------------------------------------------------------ *
 * Shelter Coordination (the shelter half of the evacuation journey).
 *
 * Two ideas shape everything here. First, occupancy is only ever allowed to
 * change inside a transaction that has already taken the shelter row's FOR UPDATE
 * lock, so the "reserve then confirm" model cannot be raced by two officers or a
 * manager tapping confirm twice. Second, the three capacity numbers stay separate
 * all the way up: an allocation reserves space (pending) without moving who is
 * actually inside, and only a Shelter Manager's arrival confirmation raises
 * confirmed_occupancy. The recommendation and the citizen-facing band both fall
 * straight out of those same numbers, so nothing can drift from the ledger.
 * ------------------------------------------------------------------ */

const BCRYPT_ROUNDS = 12;

/** Nearest-first search window when a caller only has a point, not a district. */
const RECOMMEND_RADIUS_KM = 50;

/** A shelter this full (by confirmed heads) is flagged Limited even with space. */
const BUSY_RATIO = 0.8;

export interface AllocationLine {
  shelterId: string;
  count: number;
}

export interface ShelterRecommendation {
  /** Where to send the group, nearest-first, already split across shelters. */
  plan: {
    shelterId: string;
    shelterCode: string;
    name: string;
    district: string;
    count: number;
    distanceKm?: number;
    remainingAllocatable: number;
  }[];
  /** People who still have nowhere to go when every nearby shelter is short. */
  unmet: number;
  /** True when the plan covers the whole headcount. */
  complete: boolean;
  /** True when a single shelter could take the group on its own. */
  singleShelterFits: boolean;
}

/* ------------------------------- reads ------------------------------- */

/**
 * The two-tone status the officer's board and the citizen app both show. With a
 * requested headcount it answers "can this take my group?"; without one it
 * answers the browsing question "is there room, and is it already crowded?".
 */
export function bandFor(roll: ShelterRoll, requested?: number): ShelterBand {
  if (roll.remainingAllocatable <= 0) return "FULL";

  if (requested && requested > 0) {
    return roll.remainingAllocatable >= requested ? "AVAILABLE" : "LIMITED";
  }

  const crowded =
    roll.maxCapacity > 0 &&
    roll.confirmedOccupancy / roll.maxCapacity >= BUSY_RATIO;

  return crowded ? "LIMITED" : "AVAILABLE";
}

export async function listShelters(options: {
  district?: string;
  activeOnly?: boolean;
  near?: { latitude: number; longitude: number; radiusKm?: number };
}): Promise<ShelterRoll[]> {
  return searchShelters(options);
}

export async function shelterDetail(
  context: OfficerContext,
  id: string
): Promise<{ shelter: ShelterRoll; events: Awaited<ReturnType<typeof listEvents>> }> {
  const shelter = await findShelter(id);

  if (!shelter) {
    throw new ApiError(404, "No shelter with that reference.");
  }

  assertShelterInScope(context, shelter.district);

  return { shelter, events: await listEvents(id) };
}

/**
 * The four-band health reading the dashboards group shelters under. Derived, not
 * stored: CRITICAL when no space can be claimed at all, then how full by
 * confirmed heads — WARNING at eight tenths, STABLE at a half, calm AVAILABLE
 * below that. It is stricter than the two-tone band on purpose: a shelter with a
 * little room left but nearly full is a problem the desk should see.
 */
export function statusFor(roll: ShelterRoll): ShelterStatus {
  if (roll.remainingAllocatable <= 0) return "CRITICAL";

  const ratio =
    roll.maxCapacity > 0 ? roll.confirmedOccupancy / roll.maxCapacity : 1;

  if (ratio >= 0.8) return "WARNING";
  if (ratio >= 0.5) return "STABLE";
  return "AVAILABLE";
}

/**
 * Everything one shelter dashboard draws above its board: the in-scope shelters
 * with their status and running managers, a reconstructed 24h occupancy line
 * (a district total plus each shelter's own series for the detail view), and the
 * bed split for the capacity pie.
 *
 * Scope is a single district, "all districts", or a fixed set of shelter ids (a
 * manager's own). These are reads only — the write guards live in the mutators,
 * which is exactly what lets an officer browse another district yet change
 * nothing there.
 */
export async function shelterAnalytics(options: {
  district?: string | null;
  shelterIds?: string[];
}): Promise<ShelterAnalytics> {
  const scope = {
    district: options.district ?? null,
    shelterIds: options.shelterIds,
  };

  const [rows, trendGrid, districts] = await Promise.all([
    analyticsShelters(scope),
    occupancyTrend(scope, 24),
    districtsWithShelters(),
  ]);

  const shelters: ShelterAnalyticsRow[] = rows.map((roll) => ({
    ...roll,
    status: statusFor(roll),
  }));

  // The dense grid arrives shelter-then-hour; fold it into one total line and
  // per-shelter series, and collect the distinct hour buckets along the way.
  const buckets: number[] = [];
  const totalByBucket: Record<number, number> = {};
  const seriesByShelter: Record<string, OccupancyTrendPoint[]> = {};

  for (const point of trendGrid) {
    if (!(point.bucket in totalByBucket)) {
      buckets.push(point.bucket);
      totalByBucket[point.bucket] = 0;
    }
    totalByBucket[point.bucket] += point.occupancy;

    const list = (seriesByShelter[point.shelterId] ??= []);
    list.push({
      hour: new Date(point.bucket * 1000).toISOString(),
      occupancy: point.occupancy,
    });
  }

  buckets.sort((a, b) => a - b);

  const trend: OccupancyTrendPoint[] = buckets.map((bucket) => ({
    hour: new Date(bucket * 1000).toISOString(),
    occupancy: totalByBucket[bucket],
  }));

  const perShelterTrend: Record<string, OccupancyTrendPoint[]> = {};
  for (const shelter of shelters) {
    perShelterTrend[shelter.id] = seriesByShelter[shelter.id] ?? [];
  }

  const occupiedBeds = shelters.reduce((n, s) => n + s.confirmedOccupancy, 0);
  const reservedBeds = shelters.reduce((n, s) => n + s.pendingArrivals, 0);
  const totalBeds = shelters.reduce((n, s) => n + s.maxCapacity, 0);
  const freeBeds = Math.max(0, totalBeds - occupiedBeds - reservedBeds);

  return {
    district: options.district ?? null,
    districts,
    generatedAt: new Date().toISOString(),
    totalBeds,
    occupiedBeds,
    reservedBeds,
    freeBeds,
    totalOccupancy: occupiedBeds,
    trend,
    perShelterTrend,
    shelters,
  };
}

/** The same board, cut down to just the shelters this manager runs. */
export async function managerAnalytics(
  userId: string
): Promise<ShelterAnalytics> {
  const manager = await requireManager(userId);

  return shelterAnalytics({ shelterIds: manager.shelterIds });
}

export async function nearbyShelters(point: {
  latitude?: number;
  longitude?: number;
  district?: string;
}): Promise<(ShelterRoll & { status: ShelterBand })[]> {
  const district = point.district?.trim() || undefined;
  const hasFix =
    typeof point.latitude === "number" &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude);

  // The GPS path is the original design: nearest-first from the citizen's point,
  // restricted to their district when they gave one. When the handset has lost
  // signal the caller sends a district instead and we list that district's open
  // shelters alphabetically — the same answer, just not sorted by distance.
  const rolls = hasFix
    ? await searchShelters({
        district,
        activeOnly: true,
        near: { latitude: point.latitude!, longitude: point.longitude! },
      })
    : await searchShelters({ district, activeOnly: true });

  if (rolls.length === 0 && !district) {
    // A lost-GPS caller with no district either (0,0 stale fix) still deserves a
    // non-empty list, so widen to every open shelter rather than showing nothing.
    const fallback = await searchShelters({ activeOnly: true });

    return fallback.map((roll) => ({ ...roll, status: bandFor(roll) }));
  }

  return rolls.map((roll) => ({ ...roll, status: bandFor(roll) }));
}

/* --------------------------- recommendation --------------------------- */

/**
 * Order nearby open shelters by distance, then either name the nearest one big
 * enough for the whole group (the common case) or split it nearest-first across
 * several, reporting how many still have nowhere to go. That last case is exactly
 * the doc's "capacity exceeded" flow, and the officer must see the shortfall
 * rather than a plan that quietly drops people.
 */
export async function recommendShelters(params: {
  latitude: number;
  longitude: number;
  people: number;
  district?: string;
}): Promise<ShelterRecommendation> {
  const district = params.district?.trim() || undefined;
  const near = {
    latitude: params.latitude,
    longitude: params.longitude,
    radiusKm: RECOMMEND_RADIUS_KM,
  };

  // Look inside the district when we know it; widen to a radius otherwise so a
  // shelter just across a boundary can still take the group.
  let shelters = await searchShelters({ district, activeOnly: true, near });

  if (shelters.length === 0 && district) {
    shelters = await searchShelters({ activeOnly: true, near });
  }

  const usable = shelters.filter((s) => s.remainingAllocatable > 0);
  const singleShelterFits = usable.some(
    (s) => s.remainingAllocatable >= params.people
  );

  const plan: ShelterRecommendation["plan"] = [];
  let need = params.people;

  for (const shelter of usable) {
    if (need <= 0) break;

    const take = Math.min(shelter.remainingAllocatable, need);
    plan.push({
      shelterId: shelter.id,
      shelterCode: shelter.shelterCode,
      name: shelter.name,
      district: shelter.district,
      count: take,
      distanceKm: shelter.distanceKm,
      remainingAllocatable: shelter.remainingAllocatable,
    });
    need -= take;
  }

  return {
    plan,
    unmet: Math.max(0, need),
    complete: need <= 0,
    singleShelterFits,
  };
}

/* --------------------------- shelter CRUD --------------------------- */

export async function registerShelter(
  context: OfficerContext,
  input: Omit<NewShelterInput, "district"> & { district?: string }
): Promise<ShelterRoll> {
  const district = input.district?.trim() || context.district;

  if (!district) {
    throw new ApiError(
      400,
      "Tell us which district this shelter is in.",
      { district: "Required." }
    );
  }

  assertShelterInScope(context, district);

  const shelter = await withTransaction((client) =>
    createShelter(client, { ...input, district })
  );

  announceShelter(shelter.district, shelter.id, undefined, {
    message: `${shelter.name} (${shelter.shelterCode}) was registered with room for ${shelter.maxCapacity}.`,
  });

  return shelter;
}

export async function editShelter(
  context: OfficerContext,
  id: string,
  patch: ShelterPatch
): Promise<ShelterRoll> {
  const existing = await findShelter(id);

  if (!existing) {
    throw new ApiError(404, "No shelter with that reference.");
  }

  assertShelterInScope(context, existing.district);

  if (
    patch.maxCapacity !== undefined &&
    patch.maxCapacity < existing.confirmedOccupancy
  ) {
    throw new ApiError(
      409,
      `${existing.name} already holds ${existing.confirmedOccupancy} people, so its capacity cannot drop below that.`
    );
  }

  const shelter = await withTransaction((client) =>
    updateShelter(client, id, patch)
  );

  if (!shelter) {
    throw new ApiError(404, "That shelter is no longer on the register.");
  }

  // An occupancy change from editing capacity is worth an audit line.
  if (
    patch.maxCapacity !== undefined &&
    patch.maxCapacity !== existing.maxCapacity
  ) {
    await withTransaction((client) =>
      insertEvent(client, {
        shelterId: id,
        kind: "ADJUSTMENT",
        peopleDelta: 0,
        note: `Capacity set to ${patch.maxCapacity} (was ${existing.maxCapacity}).`,
        actorId: context.userId,
        actorRole: context.role,
        actorName: context.fullName,
      })
    );
  }

  announceShelter(shelter.district, shelter.id, undefined, {
    message: `${shelter.name} was updated.`,
  });

  return shelter;
}

/* ----------------------------- allocation ----------------------------- */

/**
 * Save a group's shelter plan. Any prior unarrived reservations are stood down
 * first, so re-allocating is a replace rather than a stack — this is what lets the
 * officer correct a split before anyone has arrived without leaking reserved beds.
 * Confirmed arrivals are never touched, because those people are already inside.
 */
export async function allocateGroup(
  context: OfficerContext,
  groupId: string,
  lines: AllocationLine[]
): Promise<EvacueeGroup> {
  const group = await findGroup(groupId);

  if (!group) {
    throw new ApiError(404, "No evacuee group with that reference.");
  }

  assertShelterInScope(context, group.district);

  const cleaned = lines
    .map((l) => ({ shelterId: l.shelterId, count: Math.trunc(l.count) }))
    .filter((l) => l.shelterId && l.count > 0);

  if (cleaned.length === 0) {
    throw new ApiError(
      400,
      "Add at least one shelter with a count before allocating.",
      { allocations: "At least one line is required." }
    );
  }

  const total = cleaned.reduce((sum, l) => sum + l.count, 0);

  if (total > group.peopleCount) {
    throw new ApiError(
      409,
      `Those allocations cover ${total} people, but group ${group.groupCode} only holds ${group.peopleCount}.`,
      { allocations: "Cannot allocate more people than the group has." }
    );
  }

  await withTransaction(async (client) => {
    // Drop the previous plan's reservations (occupancy is untouched by this).
    await cancelPendingForGroup(client, groupId);

    for (const line of cleaned) {
      const capacity = await lockShelterCapacity(client, line.shelterId);

      if (!capacity) {
        throw new ApiError(404, `Shelter ${line.shelterId} no longer exists.`);
      }

      if (line.count > capacity.remainingAllocatable) {
        const roll = await findShelter(line.shelterId);
        throw new ApiError(
          409,
          `${roll?.name ?? "That shelter"} can only take ${capacity.remainingAllocatable} more, not ${line.count}. Split the group across more shelters.`
        );
      }

      await insertAllocation(client, {
        groupId,
        shelterId: line.shelterId,
        allocatedCount: line.count,
        allocatedBy: context.userId,
      });

      await insertEvent(client, {
        shelterId: line.shelterId,
        groupId,
        kind: "ALLOCATED",
        peopleDelta: 0,
        note: `${line.count} of ${group.groupCode} reserved (awaiting arrival).`,
        actorId: context.userId,
        actorRole: context.role,
        actorName: context.fullName,
      });
    }

    await setGroupStatus(client, groupId, "ALLOCATED");
  });

  const updated = await findGroup(groupId);

  if (!updated) {
    throw new ApiError(500, "The allocation was saved but the group vanished.");
  }

  announceShelter(group.district, undefined, group.groupCode, {
    message: `${group.groupCode} allocated across ${cleaned.length} shelter${
      cleaned.length === 1 ? "" : "s"
    }.`,
  });

  return updated;
}

export async function cancelGroupAllocation(
  context: OfficerContext,
  groupId: string
): Promise<EvacueeGroup> {
  const group = await findGroup(groupId);

  if (!group) {
    throw new ApiError(404, "No evacuee group with that reference.");
  }

  assertShelterInScope(context, group.district);

  await withTransaction(async (client) => {
    for (const allocation of group.allocations) {
      if (allocation.status !== "PENDING") continue;

      await client.query(
        `UPDATE shelter_allocations
            SET status = 'CANCELLED', updated_at = NOW()
          WHERE id = $1`,
        [allocation.id]
      );

      await insertEvent(client, {
        shelterId: allocation.shelterId,
        groupId,
        kind: "CANCELLED",
        peopleDelta: 0,
        note: `Reservation of ${allocation.allocatedCount} for ${group.groupCode} stood down.`,
        actorId: context.userId,
        actorRole: context.role,
        actorName: context.fullName,
      });
    }

    await setGroupStatus(client, groupId, "CANCELLED");
  });

  const updated = await findGroup(groupId);

  if (!updated) {
    throw new ApiError(500, "The cancellation was saved but the group vanished.");
  }

  announceShelter(group.district, undefined, group.groupCode, {
    message: `${group.groupCode}'s pending reservations were stood down.`,
  });

  return updated;
}

/* ------------------------- arrival confirmation ------------------------- */

/**
 * The only routine that raises confirmed_occupancy for an incoming group. The
 * manager states how many actually arrived (it can be fewer than allocated); the
 * shelter row is locked, occupancy moves by exactly that number, and the group's
 * status is recomputed from all its allocations so a partly-arrived split reads
 * PARTIAL rather than a false ARRIVED.
 */
export async function confirmArrival(
  managerUserId: string,
  allocationId: string,
  arrivedCount: number,
  discrepancyNote?: string
): Promise<{ group: EvacueeGroup; shelter: ShelterRoll }> {
  const manager = await requireManager(managerUserId);
  const allocation = await findAllocation(allocationId);

  if (!allocation) {
    throw new ApiError(404, "No allocation with that reference.");
  }

  requireAssigned(manager, allocation.shelterId);

  if (allocation.status !== "PENDING") {
    throw new ApiError(
      409,
      `That arrival is already ${allocation.status.toLowerCase()}.`
    );
  }

  const arrived = Math.trunc(arrivedCount);

  if (arrived < 0 || arrived > allocation.allocatedCount) {
    throw new ApiError(
      400,
      `Arrived count must be between 0 and the ${allocation.allocatedCount} allocated.`,
      { arrivedCount: "Out of range." }
    );
  }

  const group = await findGroup(allocation.groupId);
  const shelterName = (await findShelter(allocation.shelterId))?.name;

  await withTransaction(async (client) => {
    await lockShelterCapacity(client, allocation.shelterId);

    const confirmed = await confirmAllocationArrival(client, {
      id: allocationId,
      arrivedCount: arrived,
      confirmedBy: managerUserId,
      discrepancyNote,
    });

    if (!confirmed) {
      throw new ApiError(
        409,
        "Someone confirmed this arrival a moment ago. It is already recorded."
      );
    }

    if (arrived > 0) {
      await client.query(
        `UPDATE shelters
            SET confirmed_occupancy = confirmed_occupancy + $2, updated_at = NOW()
          WHERE id = $1`,
        [allocation.shelterId, arrived]
      );
    }

    await insertEvent(client, {
      shelterId: allocation.shelterId,
      groupId: allocation.groupId,
      kind: "ARRIVAL_CONFIRMED",
      peopleDelta: arrived,
      note: `${arrived} of ${allocation.allocatedCount} from ${
        group?.groupCode ?? "a group"
      } arrived.${discrepancyNote ? ` ${discrepancyNote}` : ""}`,
      actorId: managerUserId,
      actorRole: "SHELTER_MANAGER",
      actorName: manager.fullName,
    });

    if (group) {
      await setGroupStatus(client, group.id, await deriveGroupStatus(client, group.id));
    }
  });

  const [updatedGroup, shelter] = await Promise.all([
    findGroup(allocation.groupId),
    findShelter(allocation.shelterId),
  ]);

  if (!updatedGroup || !shelter) {
    throw new ApiError(500, "The arrival was saved but could not be read back.");
  }

  announceShelter(shelter.district, shelter.id, updatedGroup.groupCode, {
    message: `${arrived} arrived at ${shelterName ?? "the shelter"} from ${
      updatedGroup.groupCode
    }.`,
  });

  return { group: updatedGroup, shelter };
}

/* ------------------------------ walk-in ------------------------------ */

/**
 * People who reached a shelter on their own (the SELF arrival source). This
 * creates their group, books them straight in as a confirmed allocation, and
 * raises occupancy in one transaction — there is no pending stage because they
 * are already standing at the door.
 */
export async function recordWalkIn(
  managerUserId: string,
  shelterId: string,
  people: number,
  vulnerable = 0
): Promise<{ group: EvacueeGroup; shelter: ShelterRoll }> {
  const manager = await requireManager(managerUserId);
  requireAssigned(manager, shelterId);

  const headcount = Math.trunc(people);

  if (headcount <= 0) {
    throw new ApiError(
      400,
      "Enter how many people walked in.",
      { people: "Must be at least 1." }
    );
  }

  const shelterRow = await findShelter(shelterId);

  if (!shelterRow) {
    throw new ApiError(404, "No shelter with that reference.");
  }

  const freeBeds = shelterRow.maxCapacity - shelterRow.confirmedOccupancy;

  if (headcount > freeBeds) {
    throw new ApiError(
      409,
      `${shelterRow.name} has room for ${freeBeds} more of its ${
        shelterRow.maxCapacity
      } beds. Send the rest to another shelter.`
    );
  }

  let groupId = "";

  await withTransaction(async (client) => {
    await lockShelterCapacity(client, shelterId);

    groupId = await insertGroup(client, {
      peopleCount: headcount,
      vulnerableCount: vulnerable,
      arrivalSource: "SELF",
      district: shelterRow.district,
      status: "ARRIVED",
    });

    await client.query(
      `INSERT INTO shelter_allocations (
          group_id, shelter_id, allocated_count, arrived_count, status,
          allocated_by, confirmed_by, confirmed_at
       )
       VALUES ($1, $2, $3, $3, 'CONFIRMED', $4, $4, NOW())`,
      [groupId, shelterId, headcount, managerUserId]
    );

    await client.query(
      `UPDATE shelters
          SET confirmed_occupancy = confirmed_occupancy + $2, updated_at = NOW()
        WHERE id = $1`,
      [shelterId, headcount]
    );

    await insertEvent(client, {
      shelterId,
      groupId,
      kind: "WALK_IN",
      peopleDelta: headcount,
      note: `${headcount} arrived on their own at ${shelterRow.name}.`,
      actorId: managerUserId,
      actorRole: "SHELTER_MANAGER",
      actorName: manager.fullName,
    });
  });

  const [group, shelter] = await Promise.all([
    findGroup(groupId),
    findShelter(shelterId),
  ]);

  if (!group || !shelter) {
    throw new ApiError(500, "The walk-in was recorded but could not be read back.");
  }

  announceShelter(shelter.district, shelter.id, group.groupCode, {
    message: `${headcount} walked in to ${shelter.name}.`,
  });

  return { group, shelter };
}

/* ----------------------------- departure ----------------------------- */

export async function recordDeparture(
  managerUserId: string,
  shelterId: string,
  people: number,
  reason?: string
): Promise<ShelterRoll> {
  const manager = await requireManager(managerUserId);
  requireAssigned(manager, shelterId);

  const leaving = Math.trunc(people);

  if (leaving <= 0) {
    throw new ApiError(
      400,
      "Enter how many people left.",
      { people: "Must be at least 1." }
    );
  }

  const before = await findShelter(shelterId);

  if (!before) {
    throw new ApiError(404, "No shelter with that reference.");
  }

  await withTransaction(async (client) => {
    const capacity = await lockShelterCapacity(client, shelterId);
    const actual = Math.min(leaving, capacity?.confirmedOccupancy ?? 0);

    await client.query(
      `UPDATE shelters
          SET confirmed_occupancy = GREATEST(0, confirmed_occupancy - $2), updated_at = NOW()
        WHERE id = $1`,
      [shelterId, actual]
    );

    await insertEvent(client, {
      shelterId,
      kind: "DEPARTURE",
      peopleDelta: -actual,
      note: `${actual} left ${before.name}${reason ? `: ${reason}` : "."}`,
      actorId: managerUserId,
      actorRole: "SHELTER_MANAGER",
      actorName: manager.fullName,
    });
  });

  const shelter = await findShelter(shelterId);

  if (!shelter) {
    throw new ApiError(404, "That shelter is no longer on the register.");
  }

  announceShelter(shelter.district, shelter.id, undefined, {
    message: `${leaving} departed from ${shelter.name}.`,
  });

  return shelter;
}

/* ---------------------------- manager reads ---------------------------- */

export async function managerShelters(
  managerUserId: string
): Promise<(ShelterRoll & { status: ShelterBand })[]> {
  const manager = await requireManager(managerUserId);
  const rolls = await Promise.all(manager.shelterIds.map((id) => findShelter(id)));

  return rolls
    .filter((r): r is ShelterRoll => r !== null)
    .map((roll) => ({ ...roll, status: bandFor(roll) }));
}

export async function managerExpectedArrivals(
  managerUserId: string
): Promise<Awaited<ReturnType<typeof listExpectedArrivals>>> {
  const manager = await requireManager(managerUserId);
  return listExpectedArrivals(manager.shelterIds);
}

/* ------------------------- shelter-manager accounts ------------------------- */

export interface NewShelterManagerInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  designation?: string;
  district?: string;
  shelterIds: string[];
}

/**
 * The District Officer creates a Shelter Manager here, and nothing about this
 * touches public registration: the user row is written ACTIVE with the
 * SHELTER_MANAGER role, then the shelter-side profile and its assignments follow
 * in the same transaction so a half-made manager can never log in.
 */
export async function createShelterManager(
  context: OfficerContext,
  input: NewShelterManagerInput
): Promise<ShelterManager> {
  const district =
    input.district?.trim() || context.district || "";

  if (!district) {
    throw new ApiError(
      400,
      "Give the district this manager covers.",
      { district: "Required." }
    );
  }

  assertShelterInScope(context, district);

  const email = input.email.trim().toLowerCase();

  if (await emailTaken(email)) {
    throw new ApiError(
      409,
      "That email already has an account.",
      { email: "Use a different email." }
    );
  }

  // Assign only to shelters that exist and, for a district officer, are in-district.
  for (const shelterId of input.shelterIds) {
    const shelter = await findShelter(shelterId);

    if (!shelter) {
      throw new ApiError(404, `No shelter with id ${shelterId}.`, {
        shelterIds: "One of the chosen shelters no longer exists.",
      });
    }

    assertShelterInScope(context, shelter.district);
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const userId = randomUUID();

  const user: NewUser = {
    id: userId,
    full_name: input.fullName.trim(),
    email,
    username: null,
    password_hash: passwordHash,
    phone_number: input.phone?.trim() || null,
    nic_number: null,
    date_of_birth: null,
    gender: null,
    address: null,
    city: null,
    district,
    postal_code: null,
    role: "SHELTER_MANAGER",
    status: "ACTIVE",
  };

  await withTransaction(async (client) => {
    await insertUser(client, user);

    const managerId = await insertManager(client, {
      userId,
      fullName: user.full_name,
      phone: user.phone_number ?? undefined,
      designation: input.designation?.trim(),
      district,
    });

    await assignManagerShelters(client, managerId, input.shelterIds, context.userId);
  });

  const manager = await findManagerByUserId(userId);

  if (!manager) {
    throw new ApiError(500, "The manager was created but could not be read back.");
  }

  return manager;
}

export async function updateShelterManager(
  context: OfficerContext,
  managerId: string,
  changes: {
    status?: ShelterManager["status"];
    shelterIds?: string[];
  }
): Promise<ShelterManager | null> {
  const managers = await listManagers();
  const target = managers.find((m) => m.id === managerId);

  if (!target) {
    throw new ApiError(404, "No shelter manager with that reference.");
  }

  assertShelterInScope(context, target.district);

  await withTransaction(async (client) => {
    if (changes.shelterIds) {
      for (const shelterId of changes.shelterIds) {
        const shelter = await findShelter(shelterId);

        if (!shelter) {
          throw new ApiError(404, `No shelter with id ${shelterId}.`);
        }

        assertShelterInScope(context, shelter.district);
      }

      await assignManagerShelters(
        client,
        managerId,
        changes.shelterIds,
        context.userId
      );
    }

    if (changes.status) {
      await setManagerStatus(client, managerId, changes.status);
    }
  });

  return findManagerByUserId(target.userId);
}

export async function listShelterManagers(
  context: OfficerContext
): Promise<ShelterManager[]> {
  return listManagers(context.district ?? undefined);
}

export async function resolveManagerProfile(
  managerUserId: string
): Promise<ShelterManager> {
  return requireManager(managerUserId);
}

/* --------------------- rescue-completed -> group handoff --------------------- */

/**
 * When a mission completes with people rescued or evacuated, those people become
 * an AWAITING_SHELTER group the officer can allocate. It is idempotent on the
 * dispatch id, so a replayed stage or a re-run of the harness never double-counts
 * the same evacuees.
 */
export async function createGroupForCompletedDispatch(
  roll: DispatchRoll
): Promise<EvacueeGroup | null> {
  const rescued = Math.trunc(roll.peopleRescued ?? 0);
  const evacuated = Math.trunc(roll.peopleEvacuated ?? 0);
  // Whoever the team brought back needs a bed, so take the larger of the two
  // figures the leader reported rather than guessing they are additive.
  const peopleCount = Math.max(rescued, evacuated);

  if (peopleCount <= 0 || !roll.district) {
    return null;
  }

  if (await groupExistsForDispatch(roll.id)) {
    return null;
  }

  const groupId = await withTransaction((client) =>
    insertGroup(client, {
      peopleCount,
      vulnerableCount: 0,
      arrivalSource: "RESCUE_TEAM",
      district: roll.district,
      originLatitude: roll.incidentLat,
      originLongitude: roll.incidentLng,
      sourceDispatchId: roll.id,
      incidentReportId: roll.reportId,
      status: "AWAITING_SHELTER",
    })
  );

  const group = await findGroup(groupId);

  if (group) {
    announceShelter(group.district, undefined, group.groupCode, {
      message: `${roll.dispatchCode} brought ${peopleCount} people needing shelter — group ${group.groupCode} is awaiting allocation.`,
    });
  }

  return group;
}

/** A team leader says they reached the shelter they were sent to. */
export async function markGroupArrivalReported(
  dispatchId: string
): Promise<EvacueeGroup | null> {
  const groups = await listGroups(undefined, true);
  const group = groups.find((g) => g.sourceDispatchId === dispatchId);

  if (!group || group.status === "ARRIVAL_REPORTED") {
    return group ?? null;
  }

  await withTransaction((client) =>
    setGroupStatus(client, group.id, "ARRIVAL_REPORTED")
  );

  const updated = await findGroup(group.id);

  if (updated) {
    announceShelter(updated.district, undefined, updated.groupCode, {
      message: `${updated.groupCode} reported they reached their shelter.`,
    });
  }

  return updated ?? null;
}

export async function officerGroups(
  context: OfficerContext,
  openOnly: boolean
): Promise<EvacueeGroup[]> {
  return listGroups(context.district ?? undefined, openOnly);
}

/**
 * An officer registers a group that arrived on its own (a SELF arrival the desk
 * heard about by phone), so it can be allocated like any rescued group. Rescue
 * teams never come through here — those are handed over automatically when a
 * mission completes.
 */
export async function createGroup(
  context: OfficerContext,
  input: {
    peopleCount: number;
    vulnerableCount?: number;
    district?: string;
    originLatitude?: number;
    originLongitude?: number;
  }
): Promise<EvacueeGroup> {
  const district = input.district?.trim() || context.district;

  if (!district) {
    throw new ApiError(
      400,
      "Tell us which district this group is in.",
      { district: "Required." }
    );
  }

  assertShelterInScope(context, district);

  const groupId = await withTransaction((client) =>
    insertGroup(client, {
      peopleCount: input.peopleCount,
      vulnerableCount: input.vulnerableCount ?? 0,
      arrivalSource: "SELF",
      district,
      originLatitude: input.originLatitude,
      originLongitude: input.originLongitude,
      status: "AWAITING_SHELTER",
    })
  );

  const group = await findGroup(groupId);

  if (!group) {
    throw new ApiError(500, "The group was created but could not be read back.");
  }

  announceShelter(district, undefined, group.groupCode, {
    message: `Group ${group.groupCode} (${input.peopleCount} people) is awaiting shelter.`,
  });

  return group;
}

/* ------------------------------- helpers ------------------------------- */

async function deriveGroupStatus(
  client: Parameters<typeof rollupGroupAllocations>[0],
  groupId: string
): Promise<EvacueeGroup["status"]> {
  const roll = await rollupGroupAllocations(client, groupId);

  // A line still waiting to be confirmed means the group is not fully in yet.
  if (roll.pendingCount > 0) return "ALLOCATED";
  if (roll.activeAllocated === 0) return "AWAITING_SHELTER";
  if (roll.activeArrived >= roll.activeAllocated) return "ARRIVED";
  return "PARTIAL";
}

async function requireManager(userId: string): Promise<ShelterManager> {
  const manager = await findManagerByUserId(userId);

  if (!manager) {
    throw new ApiError(404, "No shelter profile is attached to this account yet.");
  }

  if (manager.status !== "ACTIVE") {
    throw new ApiError(403, "This shelter manager account is suspended.");
  }

  return manager;
}

function requireAssigned(manager: ShelterManager, shelterId: string): void {
  if (!manager.shelterIds.includes(shelterId)) {
    throw new ApiError(
      403,
      "That shelter is not assigned to you. Ask the District Officer to add it."
    );
  }
}

function assertShelterInScope(context: OfficerContext, district: string): void {
  if (context.district === null) return;

  if (context.district !== district) {
    throw new ApiError(
      403,
      `That shelter is in ${district}, and your office covers ${context.district}.`
    );
  }
}

async function emailTaken(email: string): Promise<boolean> {
  const result = await pool.query("SELECT 1 FROM users WHERE LOWER(email) = $1 LIMIT 1", [
    email,
  ]);
  return (result.rowCount ?? 0) > 0;
}

function announceShelter(
  district: string,
  shelterId: string | undefined,
  groupCode: string | undefined,
  body: { message: string }
): void {
  publishDispatchEvent({
    kind: "shelter",
    district,
    shelterId,
    groupCode,
    message: body.message,
  });
}
