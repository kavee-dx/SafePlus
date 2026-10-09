import type { PoolClient } from "pg";

import pool from "../config/db";
import type {
  EvacueeGroup,
  EvacueeGroupStatus,
  OccupancyTrendPoint,
  ShelterAllocation,
  ShelterAnalyticsRow,
  ShelterEvent,
  ShelterEventKind,
  ShelterManager,
  ShelterRoll,
} from "../models/kaveesha-shelter";

/* ------------------------------------------------------------------ *
 * Data access for Shelter Coordination.
 *
 * Two ideas hold this file together. First, the capacity trio is computed in SQL
 * (confirmed_occupancy is stored, pending is summed from PENDING allocations, and
 * allocatable is the difference), so no client can read a stale "space free".
 * Second, anything that moves occupancy locks the shelter row FOR UPDATE first —
 * that lock, not the application, is what stops two officers booking the same
 * ten beds. Every mutator here takes a client so the service can wrap it in one
 * transaction alongside the allocation write and the ledger line.
 * ------------------------------------------------------------------ */

type Q = Pick<PoolClient, "query">;
type Row = Record<string, unknown>;

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function optionalText(value: unknown): string | undefined {
  const s = text(value);
  return s === "" ? undefined : s;
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

function optionalNum(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : Number(value);
}

function bool(value: unknown): boolean {
  return Boolean(value);
}

function iso(value: unknown): string {
  return value ? new Date(value as string).toISOString() : "";
}

function isoOpt(value: unknown): string | undefined {
  return value ? new Date(value as string).toISOString() : undefined;
}

function facilities(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim() !== "") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Codes are short and spoken over the phone, so they stay human. A random suffix
 * keeps two officers creating shelters at once from colliding on the unique code.
 */
function makeCode(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  const jitter = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${stamp}${jitter}`;
}

const ROLL_BODY = `
  s.id,
  s.shelter_code,
  s.name,
  s.district,
  s.address,
  s.latitude,
  s.longitude,
  s.max_capacity,
  s.confirmed_occupancy,
  COALESCE(p.pending, 0)::int                                          AS pending_arrivals,
  (s.max_capacity - s.confirmed_occupancy - COALESCE(p.pending, 0))::int AS remaining_allocatable,
  s.is_active,
  s.facilities,
  s.created_at,
  s.updated_at`;

const ROLL_FROM = `
    FROM shelters s
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(a.allocated_count - a.arrived_count), 0) AS pending
        FROM shelter_allocations a
       WHERE a.shelter_id = s.id AND a.status = 'PENDING'
    ) p ON TRUE`;

function toShelterRoll(row: Row): ShelterRoll {
  return {
    id: text(row.id),
    shelterCode: text(row.shelter_code),
    name: text(row.name),
    district: text(row.district),
    address: optionalText(row.address),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    maxCapacity: num(row.max_capacity),
    confirmedOccupancy: num(row.confirmed_occupancy),
    pendingArrivals: num(row.pending_arrivals),
    remainingAllocatable: num(row.remaining_allocatable),
    isActive: bool(row.is_active),
    facilities: facilities(row.facilities),
    distanceKm: optionalNum(row.distance_km),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export interface ShelterSearchOptions {
  district?: string;
  activeOnly?: boolean;
  near?: { latitude: number; longitude: number; radiusKm?: number };
}

/**
 * Every shelter read the app needs. When `near` is given it adds distance (km),
 * optionally bounds the search with ST_DWithin, and sorts nearest-first — the
 * enhanced form of Thathsarani's "nearest to furthest" list.
 */
export async function searchShelters(
  options: ShelterSearchOptions = {}
): Promise<ShelterRoll[]> {
  const params: unknown[] = [];
  let sql = `SELECT ${ROLL_BODY}`;

  if (options.near) {
    params.push(options.near.longitude, options.near.latitude);
    sql += `, ST_Distance(
              ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            ) / 1000.0 AS distance_km`;
  }

  sql += ROLL_FROM + " WHERE TRUE";

  if (options.district) {
    params.push(options.district);
    sql += ` AND s.district = $${params.length}`;
  }

  if (options.activeOnly) {
    sql += " AND s.is_active";
  }

  if (options.near?.radiusKm) {
    params.push(options.near.radiusKm * 1000);
    sql += ` AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
              $${params.length})`;
  }

  sql += options.near
    ? " ORDER BY distance_km ASC"
    : " ORDER BY s.name ASC";

  const result = await pool.query(sql, params);
  return result.rows.map(toShelterRoll);
}

/**
 * Read one shelter roll through whatever executor is handed in. Inside a
 * transaction the caller's uncommitted row is only visible on that same client,
 * so the create/update mutators read back through the client they were given —
 * not through the pool, which would still see the pre-commit state.
 */
export async function readShelter(q: Q, id: string): Promise<ShelterRoll | null> {
  const result = await q.query(`SELECT ${ROLL_BODY} ${ROLL_FROM} WHERE s.id = $1`, [
    id,
  ]);
  return result.rows[0] ? toShelterRoll(result.rows[0]) : null;
}

export async function findShelter(id: string): Promise<ShelterRoll | null> {
  return readShelter(pool, id);
}

/**
 * The locking read behind every occupancy change. Must run inside the caller's
 * transaction; the FOR UPDATE is the whole double-booking guard.
 */
export async function lockShelterCapacity(
  client: Q,
  id: string
): Promise<{
  maxCapacity: number;
  confirmedOccupancy: number;
  pendingArrivals: number;
  remainingAllocatable: number;
} | null> {
  const result = await client.query(
    `SELECT s.max_capacity, s.confirmed_occupancy,
            COALESCE((SELECT SUM(a.allocated_count - a.arrived_count)
                        FROM shelter_allocations a
                       WHERE a.shelter_id = s.id AND a.status = 'PENDING'), 0)::int
              AS pending_arrivals
       FROM shelters s
      WHERE s.id = $1
      FOR UPDATE`,
    [id]
  );

  if (!result.rows[0]) return null;

  const row = result.rows[0] as Row;
  const maxCapacity = num(row.max_capacity);
  const confirmedOccupancy = num(row.confirmed_occupancy);
  const pendingArrivals = num(row.pending_arrivals);

  return {
    maxCapacity,
    confirmedOccupancy,
    pendingArrivals,
    remainingAllocatable: maxCapacity - confirmedOccupancy - pendingArrivals,
  };
}

export interface NewShelterInput {
  name: string;
  district: string;
  address?: string;
  latitude: number;
  longitude: number;
  maxCapacity: number;
  facilities?: string[];
}

export async function createShelter(
  client: Q,
  input: NewShelterInput
): Promise<ShelterRoll> {
  const code = makeCode("SH");
  const result = await client.query(
    `INSERT INTO shelters (
        shelter_code, name, district, address, latitude, longitude,
        max_capacity, facilities
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, '[]'::jsonb))
     RETURNING id`,
    [
      code,
      input.name,
      input.district,
      input.address ?? null,
      input.latitude,
      input.longitude,
      input.maxCapacity,
      input.facilities ? JSON.stringify(input.facilities) : null,
    ]
  );

  const roll = await readShelter(client, result.rows[0].id as string);

  if (!roll) {
    throw new Error("The shelter was created but could not be read back.");
  }

  return roll;
}

export interface ShelterPatch {
  name?: string;
  district?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  maxCapacity?: number;
  isActive?: boolean;
  facilities?: string[];
}

/**
 * A fixed set of editable columns, each guarded so only supplied ones are written.
 * maxCapacity may drop below current occupancy; the CHECK in the table refuses it,
 * and the service surfaces that as a friendly error.
 */
export async function updateShelter(
  client: Q,
  id: string,
  patch: ShelterPatch
): Promise<ShelterRoll | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  const add = (column: string, value: unknown): void => {
    if (value === undefined) return;
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  add("name", patch.name);
  add("district", patch.district);
  add("address", patch.address);
  add("latitude", patch.latitude);
  add("longitude", patch.longitude);
  add("max_capacity", patch.maxCapacity);
  add("is_active", patch.isActive);

  if (patch.facilities !== undefined) {
    params.push(JSON.stringify(patch.facilities));
    sets.push(`facilities = $${params.length}::jsonb`);
  }

  if (sets.length === 0) return readShelter(client, id);

  params.push(new Date());
  sets.push(`updated_at = $${params.length}`);
  params.push(id);

  await client.query(
    `UPDATE shelters SET ${sets.join(", ")} WHERE id = $${params.length}`,
    params
  );

  return readShelter(client, id);
}

/* --------------------------- evacuee groups --------------------------- */

const ALLOCATION_JSON = `
  COALESCE((
    SELECT json_agg(row_to_json(al))
      FROM (
        SELECT a.id, a.shelter_id, s.shelter_code, s.name AS shelter_name,
               a.allocated_count, a.arrived_count, a.status, a.discrepancy_note,
               a.confirmed_at, a.created_at, a.updated_at,
               ub.full_name AS allocated_by_name,
               uc.full_name AS confirmed_by_name
          FROM shelter_allocations a
          JOIN shelters s ON s.id = a.shelter_id
          LEFT JOIN users ub ON ub.id = a.allocated_by
          LEFT JOIN users uc ON uc.id = a.confirmed_by
         WHERE a.group_id = g.id
         ORDER BY a.created_at ASC
      ) al
  ), '[]'::json) AS allocations`;

const GROUP_SELECT = `
  SELECT g.id, g.group_code, g.people_count, g.vulnerable_count,
         g.arrival_source, g.district, g.origin_latitude, g.origin_longitude,
         g.source_dispatch_id, g.incident_report_id, g.status,
         g.created_at, g.updated_at,
         ${ALLOCATION_JSON}
    FROM evacuee_groups g`;

function toAllocation(row: Row): ShelterAllocation {
  return {
    id: text(row.id),
    groupId: text(row.group_id),
    shelterId: text(row.shelter_id),
    shelterCode: text(row.shelter_code),
    shelterName: text(row.shelter_name),
    allocatedCount: num(row.allocated_count),
    arrivedCount: num(row.arrived_count),
    status: text(row.status) as ShelterAllocation["status"],
    allocatedByName: optionalText(row.allocated_by_name),
    confirmedByName: optionalText(row.confirmed_by_name),
    confirmedAt: isoOpt(row.confirmed_at),
    discrepancyNote: optionalText(row.discrepancy_note),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function toGroup(row: Row): EvacueeGroup {
  const allocations = Array.isArray(row.allocations)
    ? (row.allocations as Row[]).map((a) => toAllocation({ ...a, group_id: text(row.id) }))
    : [];

  return {
    id: text(row.id),
    groupCode: text(row.group_code),
    peopleCount: num(row.people_count),
    vulnerableCount: num(row.vulnerable_count),
    arrivalSource: text(row.arrival_source) as EvacueeGroup["arrivalSource"],
    district: text(row.district),
    originLatitude: optionalNum(row.origin_latitude),
    originLongitude: optionalNum(row.origin_longitude),
    sourceDispatchId: optionalText(row.source_dispatch_id),
    incidentReportId: optionalText(row.incident_report_id),
    status: text(row.status) as EvacueeGroupStatus,
    allocations,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export async function listGroups(
  district?: string,
  openOnly = false
): Promise<EvacueeGroup[]> {
  const params: unknown[] = [];
  let sql = GROUP_SELECT + " WHERE TRUE";

  if (district) {
    params.push(district);
    sql += ` AND g.district = $${params.length}`;
  }

  if (openOnly) {
    sql += ` AND g.status IN ('AWAITING_SHELTER', 'ALLOCATED', 'IN_TRANSIT', 'ARRIVAL_REPORTED')`;
  }

  sql += " ORDER BY g.created_at DESC";

  const result = await pool.query(sql, params);
  return result.rows.map(toGroup);
}

export async function findGroup(id: string): Promise<EvacueeGroup | null> {
  const result = await pool.query(`${GROUP_SELECT} WHERE g.id = $1`, [id]);
  return result.rows[0] ? toGroup(result.rows[0]) : null;
}

/** Idempotency guard for the rescue-completed handoff: one group per dispatch. */
export async function groupExistsForDispatch(dispatchId: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM evacuee_groups WHERE source_dispatch_id = $1 LIMIT 1",
    [dispatchId]
  );
  return (result.rowCount ?? 0) > 0;
}

export interface NewGroupInput {
  peopleCount: number;
  vulnerableCount?: number;
  arrivalSource: EvacueeGroup["arrivalSource"];
  district: string;
  originLatitude?: number;
  originLongitude?: number;
  sourceDispatchId?: string;
  incidentReportId?: string;
  status?: EvacueeGroupStatus;
}

export async function insertGroup(client: Q, input: NewGroupInput): Promise<string> {
  const result = await client.query(
    `INSERT INTO evacuee_groups (
        group_code, people_count, vulnerable_count, arrival_source, district,
        origin_latitude, origin_longitude, source_dispatch_id, incident_report_id, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'AWAITING_SHELTER'))
     RETURNING id`,
    [
      makeCode("EG"),
      input.peopleCount,
      input.vulnerableCount ?? 0,
      input.arrivalSource,
      input.district,
      input.originLatitude ?? null,
      input.originLongitude ?? null,
      input.sourceDispatchId ?? null,
      input.incidentReportId ?? null,
      input.status ?? "AWAITING_SHELTER",
    ]
  );

  return result.rows[0].id as string;
}

export async function setGroupStatus(
  client: Q,
  id: string,
  status: EvacueeGroupStatus
): Promise<void> {
  await client.query(
    "UPDATE evacuee_groups SET status = $2, updated_at = NOW() WHERE id = $1",
    [id, status]
  );
}

/* --------------------------- allocations --------------------------- */

export async function insertAllocation(
  client: Q,
  input: {
    groupId: string;
    shelterId: string;
    allocatedCount: number;
    allocatedBy: string;
  }
): Promise<string> {
  const result = await client.query(
    `INSERT INTO shelter_allocations (
        group_id, shelter_id, allocated_count, status, allocated_by
     )
     VALUES ($1, $2, $3, 'PENDING', $4)
     RETURNING id`,
    [input.groupId, input.shelterId, input.allocatedCount, input.allocatedBy]
  );

  return result.rows[0].id as string;
}

export async function findAllocation(
  id: string
): Promise<{ shelterId: string; groupId: string; allocatedCount: number; arrivedCount: number; status: string } | null> {
  const result = await pool.query(
    `SELECT shelter_id, group_id, allocated_count, arrived_count, status
       FROM shelter_allocations WHERE id = $1`,
    [id]
  );
  const row = result.rows[0] as Row | undefined;
  if (!row) return null;
  return {
    shelterId: text(row.shelter_id),
    groupId: text(row.group_id),
    allocatedCount: num(row.allocated_count),
    arrivedCount: num(row.arrived_count),
    status: text(row.status),
  };
}

export async function confirmAllocationArrival(
  client: Q,
  input: {
    id: string;
    arrivedCount: number;
    confirmedBy: string;
    discrepancyNote?: string;
  }
): Promise<boolean> {
  const result = await client.query(
    `UPDATE shelter_allocations
        SET arrived_count = $2, status = 'CONFIRMED', confirmed_by = $3,
            confirmed_at = NOW(), discrepancy_note = $4, updated_at = NOW()
      WHERE id = $1 AND status = 'PENDING'`,
    [
      input.id,
      input.arrivedCount,
      input.confirmedBy,
      input.discrepancyNote ?? null,
    ]
  );

  return (result.rowCount ?? 0) > 0;
}

/** The group's allocation roll-up, so the service can name its status honestly. */
export async function rollupGroupAllocations(
  client: Q,
  groupId: string
): Promise<{
  activeAllocated: number;
  activeArrived: number;
  pendingCount: number;
  confirmedCount: number;
}> {
  const result = await client.query(
    `SELECT
        COALESCE(SUM(a.allocated_count) FILTER (WHERE a.status <> 'CANCELLED'), 0)::int
          AS active_allocated,
        COALESCE(SUM(a.arrived_count) FILTER (WHERE a.status <> 'CANCELLED'), 0)::int
          AS active_arrived,
        COUNT(*) FILTER (WHERE a.status = 'PENDING')::int    AS pending_count,
        COUNT(*) FILTER (WHERE a.status = 'CONFIRMED')::int  AS confirmed_count
       FROM shelter_allocations a
      WHERE a.group_id = $1`,
    [groupId]
  );
  const row = (result.rows[0] ?? {}) as Row;

  return {
    activeAllocated: num(row.active_allocated),
    activeArrived: num(row.active_arrived),
    pendingCount: num(row.pending_count),
    confirmedCount: num(row.confirmed_count),
  };
}

/** Stand a whole group's unarrived reservations down; returns beds freed. */
export async function cancelPendingForGroup(
  client: Q,
  groupId: string
): Promise<number> {
  const result = await client.query(
    `UPDATE shelter_allocations
        SET status = 'CANCELLED', updated_at = NOW()
      WHERE group_id = $1 AND status = 'PENDING'`,
    [groupId]
  );
  return result.rowCount ?? 0;
}

/** PENDING allocations expected at any of a manager's shelters. */
export async function listExpectedArrivals(
  shelterIds: string[]
): Promise<ShelterAllocation[]> {
  if (shelterIds.length === 0) return [];

  const result = await pool.query(
    `SELECT a.id, a.group_id, a.shelter_id, s.shelter_code, s.name AS shelter_name,
            a.allocated_count, a.arrived_count, a.status,
            a.confirmed_at, a.created_at, a.updated_at,
            ub.full_name AS allocated_by_name
       FROM shelter_allocations a
       JOIN shelters s ON s.id = a.shelter_id
       LEFT JOIN users ub ON ub.id = a.allocated_by
      WHERE a.status = 'PENDING' AND a.shelter_id = ANY($1::uuid[])
      ORDER BY a.created_at ASC`,
    [shelterIds]
  );

  return result.rows.map(toAllocation);
}

/* --------------------------- the ledger --------------------------- */

export interface NewEventInput {
  shelterId: string;
  groupId?: string;
  kind: ShelterEventKind;
  peopleDelta: number;
  note?: string;
  actorId?: string;
  actorRole?: string;
  actorName?: string;
}

export async function insertEvent(client: Q, input: NewEventInput): Promise<void> {
  await client.query(
    `INSERT INTO shelter_events (
        shelter_id, group_id, kind, people_delta, note, actor_id, actor_role, actor_name
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.shelterId,
      input.groupId ?? null,
      input.kind,
      input.peopleDelta,
      input.note ?? null,
      input.actorId ?? null,
      input.actorRole ?? null,
      input.actorName ?? null,
    ]
  );
}

export async function listEvents(
  shelterId: string,
  limit = 40
): Promise<ShelterEvent[]> {
  const result = await pool.query(
    `SELECT id, shelter_id, group_id, kind, people_delta, note,
            actor_role, actor_name, created_at
       FROM shelter_events
      WHERE shelter_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [shelterId, limit]
  );

  return (result.rows as Row[]).map((row) => ({
    id: text(row.id),
    shelterId: text(row.shelter_id),
    groupId: optionalText(row.group_id),
    kind: text(row.kind) as ShelterEventKind,
    peopleDelta: num(row.people_delta),
    note: optionalText(row.note),
    actorName: optionalText(row.actor_name),
    actorRole: optionalText(row.actor_role),
    createdAt: iso(row.created_at),
  }));
}

/* --------------------------- shelter managers --------------------------- */

const MANAGER_SELECT = `
  SELECT m.id, m.user_id, m.full_name, m.phone_number, m.designation,
         m.district, m.status, m.created_at, u.email,
         COALESCE((
           SELECT json_agg(row_to_json(sh))
             FROM (
               SELECT s.id, s.shelter_code, s.name
                 FROM shelter_manager_assignments asg
                 JOIN shelters s ON s.id = asg.shelter_id
                WHERE asg.manager_id = m.id
                ORDER BY s.name ASC
             ) sh
         ), '[]'::json) AS shelters
    FROM shelter_managers m
    LEFT JOIN users u ON u.id = m.user_id`;

function toManager(row: Row): ShelterManager {
  const shelters = Array.isArray(row.shelters)
    ? (row.shelters as Row[]).map((s) => ({
        id: text(s.id),
        shelterCode: text(s.shelter_code),
        name: text(s.name),
      }))
    : [];

  return {
    id: text(row.id),
    userId: text(row.user_id),
    fullName: text(row.full_name),
    email: optionalText(row.email),
    phone: optionalText(row.phone_number),
    designation: optionalText(row.designation),
    district: text(row.district),
    status: text(row.status) as ShelterManager["status"],
    shelterIds: shelters.map((s) => s.id),
    shelters,
    createdAt: iso(row.created_at),
  };
}

export async function findManagerByUserId(
  userId: string
): Promise<ShelterManager | null> {
  const result = await pool.query(`${MANAGER_SELECT} WHERE m.user_id = $1`, [userId]);
  return result.rows[0] ? toManager(result.rows[0]) : null;
}

export async function listManagers(district?: string): Promise<ShelterManager[]> {
  const params: unknown[] = [];
  let sql = MANAGER_SELECT;

  if (district) {
    params.push(district);
    sql += ` WHERE m.district = $${params.length}`;
  }

  sql += " ORDER BY m.full_name ASC";

  const result = await pool.query(sql, params);
  return result.rows.map(toManager);
}

export async function insertManager(
  client: Q,
  input: {
    userId: string;
    fullName: string;
    phone?: string;
    designation?: string;
    district: string;
  }
): Promise<string> {
  const result = await client.query(
    `INSERT INTO shelter_managers (user_id, full_name, phone_number, designation, district)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      input.userId,
      input.fullName,
      input.phone ?? null,
      input.designation ?? null,
      input.district,
    ]
  );

  return result.rows[0].id as string;
}

/** Replace the whole assignment set, so an edit that removes a shelter sticks. */
export async function assignManagerShelters(
  client: Q,
  managerId: string,
  shelterIds: string[],
  assignedBy?: string
): Promise<void> {
  await client.query(
    "DELETE FROM shelter_manager_assignments WHERE manager_id = $1",
    [managerId]
  );

  for (const shelterId of shelterIds) {
    await client.query(
      `INSERT INTO shelter_manager_assignments (manager_id, shelter_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [managerId, shelterId, assignedBy ?? null]
    );
  }
}

export async function setManagerStatus(
  client: Q,
  managerId: string,
  status: ShelterManager["status"]
): Promise<void> {
  await client.query(
    "UPDATE shelter_managers SET status = $2, updated_at = NOW() WHERE id = $1",
    [managerId, status]
  );
}

/* ------------------------------------------------------------------ *
 * Analytics — reads that power the dashboards' charts, status board and
 * district switcher. These never mutate anything; every one of them locks
 * reads to ACTIVE shelters and to a scope the caller is allowed to see. A
 * District Officer may READ any district (the switcher) but the write path in
 * the service still refuses any change outside their own.
 * ------------------------------------------------------------------ */

type AnalyticsScope = {
  district?: string | null;
  shelterIds?: string[];
};

/** Adds the scope predicate (an explicit shelter-id set always wins). */
function scopeClause(scope: AnalyticsScope, params: unknown[]): string {
  // An id set that was passed in is honoured even when empty — a manager with no
  // assignment must see zero shelters, not the whole country.
  if (scope.shelterIds !== undefined) {
    params.push(scope.shelterIds);
    return ` AND s.id = ANY($${params.length})`;
  }

  if (scope.district) {
    params.push(scope.district);
    return ` AND s.district = $${params.length}`;
  }

  // No district and no id list means "every district" — valid only for a read.
  return "";
}

function managersList(value: unknown): ShelterAnalyticsRow["managers"] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return [];
          }
        })()
      : [];

  return (raw as Row[]).map((m) => ({
    id: text(m.id),
    fullName: text(m.fullName),
    email: optionalText(m.email),
    phone: optionalText(m.phone),
  }));
}

/** The districts that have at least one open shelter — for the switcher. */
export async function districtsWithShelters(): Promise<string[]> {
  const result = await pool.query(
    `SELECT district FROM shelters WHERE is_active GROUP BY district ORDER BY district ASC`
  );

  return (result.rows as Row[]).map((row) => text(row.district));
}

/**
 * Active shelters in scope, each with its capacity trio and the ACTIVE managers
 * assigned to it. Status is derived in the service (it is a display reading, not
 * a stored column) so the number stays the single source of truth here.
 */
export async function analyticsShelters(
  scope: AnalyticsScope
): Promise<(ShelterRoll & { managers: ShelterAnalyticsRow["managers"] })[]> {
  const params: unknown[] = [];
  let sql = `SELECT ${ROLL_BODY},
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', m.id, 'fullName', m.full_name, 'email', u.email, 'phone', m.phone_number))
        FROM shelter_manager_assignments asg
        JOIN shelter_managers m ON m.id = asg.manager_id
        LEFT JOIN users u ON u.id = m.user_id
       WHERE asg.shelter_id = s.id AND m.status = 'ACTIVE'
    ), '[]'::json) AS managers`;

  sql += ROLL_FROM + " WHERE TRUE";
  sql += scopeClause(scope, params);
  sql += " AND s.is_active ORDER BY s.district ASC, s.name ASC";

  const result = await pool.query(sql, params);

  return (result.rows as Row[]).map((row) => ({
    ...toShelterRoll(row),
    managers: managersList(row.managers),
  }));
}

/**
 * The last 24 hours of confirmed occupancy, reconstructed from the append-only
 * ledger rather than stored: at any past hour the number inside was today's
 * figure minus everything that happened after it. Only the kinds that actually
 * move occupancy are summed (allocations and cancellations reserve space, they
 * do not fill beds). Returns a dense grid — one point per shelter per hour.
 */
export async function occupancyTrend(
  scope: AnalyticsScope,
  hours = 24
): Promise<{ shelterId: string; bucket: number; occupancy: number }[]> {
  const span = Math.max(2, Math.min(72, Math.trunc(hours)));
  const params: unknown[] = [];

  let sql = `WITH hours AS (
    SELECT NOW() - (interval '1 hour' * g) AS h
      FROM generate_series(${span - 1}, 0, -1) AS g
  )
  SELECT s.id AS shelter_id,
         EXTRACT(EPOCH FROM hours.h)::bigint AS bucket,
         GREATEST(0, s.confirmed_occupancy - COALESCE(ev.after_delta, 0))::int AS occupancy
    FROM shelters s
    CROSS JOIN hours
    LEFT JOIN LATERAL (
      SELECT SUM(e.people_delta) AS after_delta
        FROM shelter_events e
       WHERE e.shelter_id = s.id
         AND e.kind IN ('WALK_IN', 'ARRIVAL_CONFIRMED', 'DEPARTURE', 'ADJUSTMENT')
         AND e.created_at > hours.h
    ) ev ON TRUE
   WHERE TRUE`;

  sql += scopeClause(scope, params);
  sql += " AND s.is_active ORDER BY hours.h ASC";

  const result = await pool.query(sql, params);

  return (result.rows as Row[]).map((row) => ({
    shelterId: text(row.shelter_id),
    bucket: num(row.bucket),
    occupancy: num(row.occupancy),
  }));
}
