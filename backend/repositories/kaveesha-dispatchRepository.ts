import pool from "../config/db";
import type { EvidenceAttachment } from "../models/amasha-hazardReportExt";
import {
  type DispatchEvent,
  type DispatchRoll,
  type DispatchStatus,
  type IncidentSummary,
  type RescueDispatch,
  LIVE_DISPATCH_STATUSES,
} from "../models/kaveesha-rescueDispatch";

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function optionalText(value: unknown): string | undefined {
  const value2 = text(value);

  return value2 === "" ? undefined : value2;
}

function num(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : Number(value);
}

function date(value: unknown): Date | undefined {
  return value ? (value as Date) : undefined;
}

function bool(value: unknown): boolean {
  return Boolean(value);
}

/** Kept in step with the model so SQL and code can never disagree on "live". */
const LIVE_LIST = `ARRAY[${LIVE_DISPATCH_STATUSES.map((status) => `'${status}'`).join(
  ", "
)}]::text[]`;

/**
 * A verified ground report is the incident. Everything here reads the teammate's
 * UC-02 tables; nothing re-writes them.
 */
const INCIDENT_SELECT = `
  SELECT r.id,
         r.report_id,
         r.hazard_type,
         r.severity_level,
         r.location_district,
         r.location_lat,
         r.location_lng,
         r.landmark,
         r.description,
         r.affected_population,
         r.immediate_danger,
         r.observed_at,
         r.verified_at,
         r.verification_notes,
         reporter.full_name AS reporter_name,
         reporter.phone_number AS reporter_phone,
         verifier.full_name AS verified_by_name,
         (SELECT COUNT(*) FROM report_attachments a
           WHERE a.report_id = r.id AND a.file_kind = 'PHOTO')::int AS photo_count,
         -- Evidence is stored as data URLs, so the first photo doubles as the
         -- thumbnail a list can paint without reading every attachment.
         (SELECT a.file_url FROM report_attachments a
           WHERE a.report_id = r.id AND a.file_kind = 'PHOTO'
           ORDER BY a.created_at ASC LIMIT 1) AS thumbnail_url,
         (SELECT COUNT(*) FROM rescue_dispatches d
           WHERE d.report_id = r.id AND d.status = ANY(${LIVE_LIST}))::int
             AS live_dispatch_count,
         (SELECT COUNT(*) FROM rescue_dispatches d
           WHERE d.report_id = r.id)::int AS dispatch_count,
         acc.accepted_at,
         acc.handover_note,
         acceptor.full_name AS accepted_by_name
    FROM hazard_reports r
    LEFT JOIN users reporter ON reporter.id = r.reporter_id
    LEFT JOIN users verifier ON verifier.id = r.verified_by
    -- The district's own acceptance, written only by the incident desk below.
    LEFT JOIN district_incident_acceptance acc ON acc.report_id = r.id
    LEFT JOIN users acceptor ON acceptor.id = acc.accepted_by
`;

function toIncident(row: Row): IncidentSummary {
  return {
    id: text(row.id),
    reportId: text(row.report_id),
    hazardType: text(row.hazard_type),
    severityLevel: text(row.severity_level),
    locationDistrict: text(row.location_district),
    locationLat: num(row.location_lat),
    locationLng: num(row.location_lng),
    landmark: optionalText(row.landmark),
    description: text(row.description),
    affectedPopulation: num(row.affected_population),
    immediateDanger: bool(row.immediate_danger),
    observedAt: date(row.observed_at),
    verifiedAt: date(row.verified_at),
    verifiedByName: optionalText(row.verified_by_name),
    reporterName: optionalText(row.reporter_name),
    reporterPhone: optionalText(row.reporter_phone),
    photoCount: num(row.photo_count) ?? 0,
    thumbnailUrl: optionalText(row.thumbnail_url),
    liveDispatchCount: num(row.live_dispatch_count) ?? 0,
    dispatchCount: num(row.dispatch_count) ?? 0,
    acceptedAt: row.accepted_at ? date(row.accepted_at) : undefined,
    acceptedByName: optionalText(row.accepted_by_name),
    handoverNote: optionalText(row.handover_note),
  };
}

export async function listVerifiedIncidents(
  district?: string
): Promise<IncidentSummary[]> {
  const params: unknown[] = [];
  let sql = `${INCIDENT_SELECT} WHERE r.status = 'VERIFIED'`;

  if (district) {
    params.push(district);
    sql += ` AND r.location_district = $${params.length}`;
  }

  sql += " ORDER BY r.verified_at DESC NULLS LAST, r.created_at DESC LIMIT 100";

  const result = await pool.query(sql, params);

  return result.rows.map(toIncident);
}

/** Accepts either the internal uuid or the printed RPT- code. */
export async function findIncident(
  identifier: string
): Promise<IncidentSummary | null> {
  const result = await pool.query(
    `${INCIDENT_SELECT} WHERE r.status = 'VERIFIED'
        AND (r.id::text = $1 OR r.report_id = $1) LIMIT 1`,
    [identifier]
  );

  return result.rows[0] ? toIncident(result.rows[0]) : null;
}

/**
 * Record that the district office has taken a verified incident on.
 *
 * Re-accepting is allowed and only ever adds to the record: the first
 * accepted_at stands, because "when did this become our job" must not move each
 * time someone clicks the button again, while a later handover note replaces the
 * earlier one, which is what the control room is actually correcting.
 */
export async function recordAcceptance(
  reportId: string,
  officerUserId: string,
  handoverNote?: string
): Promise<void> {
  await pool.query(
    `INSERT INTO district_incident_acceptance (report_id, accepted_by, handover_note)
     VALUES ($1::uuid, $2::uuid, $3::text)
     ON CONFLICT (report_id) DO UPDATE
        SET handover_note = COALESCE(EXCLUDED.handover_note,
                                     district_incident_acceptance.handover_note),
            updated_at = NOW()`,
    [reportId, officerUserId, handoverNote ?? null]
  );
}

/** Evidence is stored as data URLs, so the portal needs no file server. */
export async function listEvidence(
  reportId: string
): Promise<EvidenceAttachment[]> {
  const result = await pool.query(
    `SELECT id, report_id, file_url, file_kind, content_type, created_at
       FROM report_attachments
      WHERE report_id = $1
      ORDER BY created_at ASC`,
    [reportId]
  );

  return result.rows.map((row) => ({
    id: text(row.id),
    reportId: text(row.report_id),
    fileUrl: text(row.file_url),
    fileKind: text(row.file_kind) === "VIDEO" ? ("VIDEO" as const) : ("PHOTO" as const),
    contentType: optionalText(row.content_type),
    createdAt: row.created_at as Date,
  }));
}

export interface TeamCandidateRow {
  teamId: string;
  teamName: string;
  teamType?: string;
  affiliation: string;
  organizationName?: string;
  district: string;
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
  distanceKm: number | null;
  liveDispatches: number;
}

const TEAM_CANDIDATE_SELECT = `
  SELECT t.id                                                 AS team_id,
         t.team_name,
         t.team_type,
         t.affiliation,
         t.organization_name,
         t.operating_district                                 AS district,
         t.availability,
         t.leader_full_name,
         t.leader_phone_number                                AS leader_phone,
         t.leader_designation,
         t.team_contact_number,
         t.member_count,
         COALESCE(t.capabilities, ARRAY[]::text[])            AS capabilities,
         COALESCE(t.equipment, ARRAY[]::text[])               AS equipment,
         t.base_latitude,
         t.base_longitude,
         t.base_location_label,
         -- PostGIS is installed and this is where it pays for itself: a real
         -- geodesic distance in metres, converted here rather than in JS.
         CASE WHEN t.base_latitude IS NOT NULL
                   AND t.base_longitude IS NOT NULL
                   AND ST_DWithin(
                         geog::geography,
                         ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                         $3)
              THEN ST_Distance(
                     geog::geography,
                     ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) / 1000.0
         END                                                  AS distance_km,
         (SELECT COUNT(*) FROM rescue_dispatches d
           WHERE d.team_id = t.id AND d.status = ANY(${LIVE_LIST}))::int
             AS live_dispatches
    FROM (
      SELECT tl.*,
             ST_SetSRID(ST_MakePoint(tl.base_longitude, tl.base_latitude), 4326)
               AS geog
        FROM team_leaders tl
    ) t
    JOIN users u ON u.id = t.user_id
   WHERE u.status = 'ACTIVE'
     AND t.team_type IS NOT NULL
     -- In-district teams are always offered, even without a saved base; nearby
     -- teams from other districts come next as labelled mutual aid.
     AND (t.operating_district = $4 OR t.base_latitude IS NOT NULL)
   ORDER BY distance_km NULLS LAST, t.team_name
   LIMIT 200
`;

/**
 * Teams within `radiusKm` of the incident, plus every team in the incident's own
 * district, so an officer is never told "nobody is near" when the honest answer
 * is "nobody is near and in-district".
 */
export async function listTeamCandidates(
  point: { lat: number; lng: number },
  district: string,
  radiusKm = 60
): Promise<TeamCandidateRow[]> {
  const result = await pool.query<Row>(TEAM_CANDIDATE_SELECT, [
    point.lat,
    point.lng,
    radiusKm * 1000,
    district,
  ]);

  return result.rows.map((row) => ({
    teamId: text(row.team_id),
    teamName: text(row.team_name),
    teamType: optionalText(row.team_type),
    affiliation: text(row.affiliation),
    organizationName: optionalText(row.organization_name),
    district: text(row.district),
    availability: text(row.availability),
    leaderFullName: text(row.leader_full_name),
    leaderPhone: text(row.leader_phone),
    leaderDesignation: optionalText(row.leader_designation),
    teamContactNumber: optionalText(row.team_contact_number),
    memberCount: num(row.member_count) ?? 0,
    capabilities: (row.capabilities as string[] | null) ?? [],
    equipment: (row.equipment as string[] | null) ?? [],
    baseLatitude: num(row.base_latitude),
    baseLongitude: num(row.base_longitude),
    baseLocationLabel: optionalText(row.base_location_label),
    distanceKm:
      row.distance_km === null || row.distance_km === undefined
        ? null
        : Number(row.distance_km),
    liveDispatches: num(row.live_dispatches) ?? 0,
  }));
}

const DISPATCH_SELECT = `
  SELECT d.id,
         d.dispatch_code,
         d.report_id,
         d.team_id,
         d.dispatched_by,
         d.district,
         d.status,
         d.mission_notes,
         d.recommendation_score,
         d.recommendation_factors,
         d.people_rescued,
         d.people_evacuated,
         d.decline_reason,
         d.cancel_reason,
         d.accepted_at,
         d.en_route_at,
         d.arrived_at,
         d.rescue_started_at,
         d.returned_at,
         d.completed_at,
         d.declined_at,
         d.cancelled_at,
         d.created_at,
         d.updated_at
`;

function toDispatch(row: Row): RescueDispatch {
  return {
    id: text(row.id),
    dispatchCode: text(row.dispatch_code),
    reportId: text(row.report_id),
    teamId: text(row.team_id),
    dispatchedBy: optionalText(row.dispatched_by),
    district: text(row.district),
    status: text(row.status) as DispatchStatus,
    missionNotes: optionalText(row.mission_notes),
    recommendationScore: num(row.recommendation_score),
    recommendationFactors: (row.recommendation_factors as Record<string, unknown>) ?? undefined,
    peopleRescued: num(row.people_rescued),
    peopleEvacuated: num(row.people_evacuated),
    declineReason: optionalText(row.decline_reason),
    cancelReason: optionalText(row.cancel_reason),
    acceptedAt: date(row.accepted_at),
    enRouteAt: date(row.en_route_at),
    arrivedAt: date(row.arrived_at),
    rescueStartedAt: date(row.rescue_started_at),
    completedAt: date(row.completed_at),
    returnedAt: date(row.returned_at),
    declinedAt: date(row.declined_at),
    cancelledAt: date(row.cancelled_at),
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

/**
 * Read back by uuid or by the printed code, so an officer who is working from a
 * phone call can paste "DSP-…" into the board. Compared as text on purpose: a
 * malformed reference must return nothing, not abort the query.
 */
export async function findDispatchById(id: string): Promise<RescueDispatch | null> {
  const result = await pool.query(
    `${DISPATCH_SELECT} FROM rescue_dispatches d WHERE d.id::text = $1 OR d.dispatch_code = $1 LIMIT 1`,
    [id]
  );

  return result.rows[0] ? toDispatch(result.rows[0]) : null;
}

/** The printed code is what two people on a phone call actually have. */
export async function findDispatchByCode(code: string): Promise<RescueDispatch | null> {
  const result = await pool.query(
    `${DISPATCH_SELECT} FROM rescue_dispatches d WHERE d.dispatch_code = $1 LIMIT 1`,
    [code]
  );

  return result.rows[0] ? toDispatch(result.rows[0]) : null;
}

export interface NewDispatch {
  dispatchCode: string;
  reportId: string;
  teamId: string;
  dispatchedBy: string;
  district: string;
  missionNotes?: string;
  recommendationScore?: number;
  recommendationFactors?: Record<string, unknown>;
}

/**
 * Creating a mission and reserving the team are one statement, because a
 * dispatch that exists while the team still reads AVAILABLE invites a second
 * officer to task the same boat twice.
 */
export async function insertDispatch(input: NewDispatch): Promise<RescueDispatch> {
  const result = await pool.query(
    `WITH created AS (
       INSERT INTO rescue_dispatches (
         dispatch_code, report_id, team_id, dispatched_by, district, status,
         mission_notes, recommendation_score, recommendation_factors
       ) VALUES (
         $1, $2::uuid, $3::uuid, $4::uuid, $5, 'DISPATCHED',
         $6, $7, COALESCE($8::jsonb, '{}'::jsonb)
       )
       RETURNING id, team_id
     ), reserved AS (
       UPDATE team_leaders tl
          SET availability = 'ON_DEPLOYMENT', updated_at = NOW()
         FROM created c
        WHERE tl.id = c.team_id
       RETURNING tl.id
     ), logged AS (
       INSERT INTO rescue_dispatch_events (dispatch_id, from_status, to_status, actor_id, actor_role, note)
       SELECT c.id, NULL, 'DISPATCHED', $4::uuid,
              (SELECT role FROM users WHERE id = $4::uuid),
              'Dispatched by the district control room.'
         FROM created c
       RETURNING 1
     )
     SELECT id FROM created LIMIT 1`,
    [
      input.dispatchCode,
      input.reportId,
      input.teamId,
      input.dispatchedBy,
      input.district,
      input.missionNotes ?? null,
      input.recommendationScore ?? null,
      input.recommendationFactors
        ? JSON.stringify(input.recommendationFactors)
        : null,
    ]
  );

  const created = await findDispatchById(text(result.rows[0].id));

  if (!created) {
    throw new Error("The dispatch could not be stored.");
  }

  return created;
}

const STAGE_COLUMN: Record<string, string | null> = {
  ACCEPTED: "accepted_at",
  EN_ROUTE: "en_route_at",
  ARRIVED: "arrived_at",
  RESCUE_IN_PROGRESS: "rescue_started_at",
  RETURNING: "returned_at",
  COMPLETED: "completed_at",
  DECLINED: "declined_at",
  CANCELLED: "cancelled_at",
};

export interface AdvanceResult {
  dispatch: RescueDispatch | null;
  previousStatus: DispatchStatus | null;
}

/**
 * One statement advances the stage, stamps it and appends the trail row, so the
 * timeline can never fall behind the status the portal is showing.
 */
export async function advanceDispatchStatus(
  dispatchId: string,
  nextStatus: DispatchStatus,
  actor: { userId: string; role: string },
  note?: string
): Promise<AdvanceResult> {
  const stageColumn = STAGE_COLUMN[nextStatus];

  if (!stageColumn) {
    throw new Error(`"${nextStatus}" is not a dispatch stage.`);
  }

  const result = await pool.query(
    `WITH locked AS (
       SELECT id, status FROM rescue_dispatches WHERE id = $1::uuid FOR UPDATE
     ), advanced AS (
       UPDATE rescue_dispatches d
          SET status = $2::text,
              updated_at = NOW(),
              ${stageColumn} = NOW(),
              -- The officer's instruction stays put: a leader's stage note lives
              -- on the event row, not on the mission brief.
              decline_reason = CASE WHEN $2::text = 'DECLINED' THEN COALESCE($5, decline_reason) ELSE decline_reason END,
              cancel_reason = CASE WHEN $2::text = 'CANCELLED' THEN COALESCE($5, cancel_reason) ELSE cancel_reason END
         FROM locked l
        WHERE d.id = l.id
       RETURNING d.id
     ), logged AS (
       INSERT INTO rescue_dispatch_events (dispatch_id, from_status, to_status, actor_id, actor_role, note)
       SELECT a.id, l.status, $2::text, $3::uuid, $4, $5
         FROM advanced a JOIN locked l ON l.id = a.id
       RETURNING 1
     )
     SELECT l.status AS previous_status, a.id FROM advanced a JOIN locked l ON l.id = a.id`,
    [dispatchId, nextStatus, actor.userId, actor.role, note ?? null]
  );

  const row = result.rows[0];

  if (!row) return { dispatch: null, previousStatus: null };

  return {
    dispatch: await findDispatchById(text(row.id)),
    previousStatus: text(row.previous_status) as DispatchStatus,
  };
}

/** Completion numbers belong to the mission, not to a stage change. */
export async function recordOutcome(
  dispatchId: string,
  outcome: { peopleRescued?: number; peopleEvacuated?: number }
): Promise<void> {
  await pool.query(
    `UPDATE rescue_dispatches
        SET people_rescued = COALESCE($2, people_rescued),
            people_evacuated = COALESCE($3, people_evacuated),
            updated_at = NOW()
      WHERE id = $1::uuid`,
    [dispatchId, outcome.peopleRescued ?? null, outcome.peopleEvacuated ?? null]
  );
}

/**
 * A team is only handed back when it holds no other live mission. Returns true
 * when the team went AVAILABLE so the caller can report it.
 */
export async function releaseTeamIfIdle(
  teamId: string,
  exceptDispatchId: string
): Promise<boolean> {
  const result = await pool.query(
    `WITH still_busy AS (
       SELECT 1 FROM rescue_dispatches
        WHERE team_id = $1::uuid
          AND id <> $2::uuid
          AND status = ANY(${LIVE_LIST})
        LIMIT 1
     ), freed AS (
       UPDATE team_leaders tl
          SET availability = 'AVAILABLE', updated_at = NOW()
         FROM (SELECT $1::uuid AS id) s
        WHERE tl.id = s.id
          AND NOT EXISTS (SELECT 1 FROM still_busy)
          AND tl.availability = 'ON_DEPLOYMENT'
       RETURNING tl.id
     )
     SELECT COUNT(*)::int AS released FROM freed`,
    [teamId, exceptDispatchId]
  );

  return Number(result.rows[0]?.released ?? 0) > 0;
}

export interface TeamRef {
  teamId: string;
  userId: string;
  teamName: string;
  availability: string;
}

/** A leader acts only on their own team, and that is resolved here, not asked for. */
export async function findTeamByUserId(userId: string): Promise<TeamRef | null> {
  const result = await pool.query(
    `SELECT id AS team_id, user_id, team_name, availability
       FROM team_leaders WHERE user_id = $1::uuid LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];

  return row
    ? {
        teamId: text(row.team_id),
        userId: text(row.user_id),
        teamName: text(row.team_name),
        availability: text(row.availability),
      }
    : null;
}

export async function isReportVerified(reportId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM hazard_reports
      WHERE (id::text = $1 OR report_id = $1) AND status = 'VERIFIED' LIMIT 1`,
    [reportId]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * A dispatch is always read together with the team that holds it and the
 * incident it belongs to: an officer who sees "EN ROUTE" without the location
 * and the phone number cannot act on it.
 */
const ROLL_SELECT = `
  SELECT d.id,
         d.dispatch_code,
         d.report_id,
         d.team_id,
         d.district,
         d.status,
         d.mission_notes,
         d.recommendation_score,
         d.recommendation_factors,
         d.people_rescued,
         d.people_evacuated,
         d.decline_reason,
         d.cancel_reason,
         d.accepted_at,
         d.en_route_at,
         d.arrived_at,
         d.rescue_started_at,
         d.returned_at,
         d.completed_at,
         d.declined_at,
         d.cancelled_at,
         d.created_at,
         d.updated_at,
         t.team_name,
         t.team_type,
         t.affiliation,
         t.organization_name,
         t.operating_district,
         t.leader_full_name,
         t.leader_phone_number AS leader_phone,
         leader_account.email AS leader_email,
         t.member_count,
         t.availability AS team_availability,
         t.base_latitude,
         t.base_longitude,
         t.base_location_label,
         r.report_id AS report_public_id,
         r.hazard_type,
         r.severity_level,
         r.landmark,
         r.location_lat AS incident_lat,
         r.location_lng AS incident_lng,
         r.affected_population,
         r.immediate_danger,
         dispatcher.full_name AS dispatched_by_name,
         -- A team on the road must be able to call the office that sent it.
         control_officer.duty_phone_number AS control_phone,
         (SELECT COALESCE(json_agg(ev ORDER BY ev.created_at), '[]'::json)
            FROM (
              SELECT e.id, e.from_status, e.to_status, e.note, e.created_at,
                     actor.full_name AS actor_name, actor.role AS actor_role
                FROM rescue_dispatch_events e
                LEFT JOIN users actor ON actor.id = e.actor_id
               WHERE e.dispatch_id = d.id
            ) ev) AS events
    FROM rescue_dispatches d
    JOIN team_leaders t ON t.id = d.team_id
    LEFT JOIN users leader_account ON leader_account.id = t.user_id
    JOIN hazard_reports r ON r.id = d.report_id
    LEFT JOIN users dispatcher ON dispatcher.id = d.dispatched_by
    -- The office that sent the tasking, so the team can call it back. A DMC duty
    -- officer is not in district_officers, so this is legitimately null there.
    LEFT JOIN district_officers control_officer ON control_officer.user_id = d.dispatched_by
`;

interface RawEvent {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
  actor_name: string | null;
  actor_role: string | null;
}

function toEvents(value: unknown): DispatchEvent[] {
  const raw = Array.isArray(value) ? (value as RawEvent[]) : [];

  return raw.map((event) => ({
    id: text(event.id),
    fromStatus: event.from_status ? (text(event.from_status) as DispatchStatus) : null,
    toStatus: text(event.to_status) as DispatchStatus,
    actorRole: optionalText(event.actor_role),
    actorName: optionalText(event.actor_name),
    note: optionalText(event.note),
    createdAt: new Date(event.created_at),
  }));
}

function toRoll(row: Row): DispatchRoll {
  return {
    id: text(row.id),
    dispatchCode: text(row.dispatch_code),
    status: text(row.status) as DispatchStatus,
    district: text(row.district),
    missionNotes: optionalText(row.mission_notes),
    recommendationScore: num(row.recommendation_score),
    recommendationFactors:
      (row.recommendation_factors as Record<string, unknown>) ?? undefined,
    peopleRescued: num(row.people_rescued),
    peopleEvacuated: num(row.people_evacuated),
    declineReason: optionalText(row.decline_reason),
    cancelReason: optionalText(row.cancel_reason),
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    teamId: text(row.team_id),
    teamName: text(row.team_name),
    teamType: optionalText(row.team_type),
    teamAvailability: optionalText(row.team_availability),
    leaderFullName: text(row.leader_full_name),
    leaderPhone: text(row.leader_phone),
    leaderEmail: optionalText(row.leader_email),
    memberCount: num(row.member_count) ?? 0,
    baseLatitude: num(row.base_latitude),
    baseLongitude: num(row.base_longitude),
    baseLocationLabel: optionalText(row.base_location_label),
    organizationName: optionalText(row.organization_name),
    reportId: text(row.report_id),
    reportPublicId: text(row.report_public_id),
    hazardType: text(row.hazard_type),
    severityLevel: text(row.severity_level),
    landmark: optionalText(row.landmark),
    incidentLat: num(row.incident_lat),
    incidentLng: num(row.incident_lng),
    affectedPopulation: num(row.affected_population),
    immediateDanger: row.immediate_danger === null ? undefined : Boolean(row.immediate_danger),
    dispatchedByName: optionalText(row.dispatched_by_name),
    controlPhone: optionalText(row.control_phone),
    events: toEvents(row.events),
  };
}

export async function findDispatchRoll(id: string): Promise<DispatchRoll | null> {
  const result = await pool.query(`${ROLL_SELECT} WHERE d.id = $1::uuid LIMIT 1`, [id]);

  return result.rows[0] ? toRoll(result.rows[0]) : null;
}

export async function listDispatchRollsByTeam(teamId: string): Promise<DispatchRoll[]> {
  const result = await pool.query(
    `${ROLL_SELECT} WHERE d.team_id = $1::uuid
      ORDER BY (d.status = ANY(${LIVE_LIST})) DESC, d.created_at DESC
      LIMIT 50`,
    [teamId]
  );

  return result.rows.map(toRoll);
}

export async function listDispatchRollsByIncident(
  reportId: string
): Promise<DispatchRoll[]> {
  const result = await pool.query(
    `${ROLL_SELECT} WHERE d.report_id = $1::uuid
      ORDER BY d.created_at DESC
      LIMIT 50`,
    [reportId]
  );

  return result.rows.map(toRoll);
}

/**
 * The officer's operations list. A DMC duty officer has no assigned district and
 * therefore sees the whole country's live missions.
 */
export async function listDispatchRollsForOfficer(
  district: string | null,
  liveOnly: boolean
): Promise<DispatchRoll[]> {
  const params: unknown[] = [];
  let sql = ROLL_SELECT;

  if (district) {
    params.push(district);
    sql += ` WHERE d.district = $${params.length}`;
  } else {
    sql += " WHERE 1 = 1";
  }

  if (liveOnly) {
    sql += ` AND d.status = ANY(${LIVE_LIST})`;
  }

  params.push(liveOnly ? 200 : 100);
  sql += ` ORDER BY (d.status = ANY(${LIVE_LIST})) DESC, d.updated_at DESC
          LIMIT $${params.length}`;

  const result = await pool.query(sql, params);

  return result.rows.map(toRoll);
}

export interface DispatchableTeam {
  id: string;
  teamName: string;
  district: string;
  availability: string;
  liveDispatches: number;
  accountStatus: string;
}

/**
 * The team a dispatch is about to be written against, read back rather than
 * trusted from the request body.
 */
export async function findTeamForDispatch(
  teamId: string
): Promise<DispatchableTeam | null> {
  const result = await pool.query(
    `SELECT t.id,
            t.team_name,
            t.operating_district                              AS district,
            t.availability,
            u.status                                          AS account_status,
            (SELECT COUNT(*) FROM rescue_dispatches d
              WHERE d.team_id = t.id AND d.status = ANY(${LIVE_LIST}))::int
              AS live_dispatches
       FROM team_leaders t
       JOIN users u ON u.id = t.user_id
      WHERE t.id = $1::uuid LIMIT 1`,
    [teamId]
  );
  const row = result.rows[0];

  return row
    ? {
        id: text(row.id),
        teamName: text(row.team_name),
        district: text(row.district),
        availability: text(row.availability),
        liveDispatches: num(row.live_dispatches) ?? 0,
        accountStatus: text(row.account_status),
      }
    : null;
}

/**
 * Missions closed since a moment in time, per team. This is the workload signal:
 * a live mission already disqualifies a team, so recent finished work is what is
 * left to weigh.
 */
export async function countClosedMissionsSince(
  since: Date
): Promise<{ teamId: string; closed: number }[]> {
  const result = await pool.query(
    `SELECT team_id, COUNT(*)::int AS closed
       FROM rescue_dispatches
      WHERE status IN ('COMPLETED', 'CANCELLED')
        AND created_at >= $1
      GROUP BY team_id`,
    [since]
  );

  return result.rows.map((row: Row) => ({
    teamId: text(row.team_id),
    closed: num(row.closed) ?? 0,
  }));
}

/** Used by the incident detail so a stale double-assign cannot slip through. */
export async function hasLiveDispatchForTeamOnReport(
  reportId: string,
  teamId: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM rescue_dispatches
      WHERE report_id = $1::uuid
        AND team_id = $2::uuid
        AND status = ANY(${LIVE_LIST})
      LIMIT 1`,
    [reportId, teamId]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

/** The leader's one live mission, if any. */
export async function findLiveDispatchForTeam(
  teamId: string
): Promise<RescueDispatch | null> {
  const result = await pool.query(
    `${DISPATCH_SELECT} FROM rescue_dispatches d
      WHERE d.team_id = $1::uuid AND d.status = ANY(${LIVE_LIST})
      ORDER BY d.created_at DESC LIMIT 1`,
    [teamId]
  );

  return result.rows[0] ? toDispatch(result.rows[0]) : null;
}
