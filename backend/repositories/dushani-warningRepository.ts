import pool from "../config/db";
import {
  BoundarySource,
  BroadcastStatus,
  ChannelType,
  WarningStatus,
  type BroadcastLog,
  type Coordinate,
  type CreateDraftRequest,
  type DisasterWarning,
  type GISPolygon,
} from "../models/disasterWarning";
import { ROLE_INTERFACES, type UserRole } from "../models/registration";
import type { AlertRecipient } from "../services/dushani-disseminationChannels";
import { findReportById, type Row } from "./dushani-hazardReportRepository";

interface WarningRow extends Row {
  id: string;
  warning_id: string;
  report_id: string;
  hazard_type: string;
  severity_level: string;
  target_district: string;
  safety_instructions: string | null;
  status: string;
  english_message: string;
  sinhala_message: string;
  tamil_message: string;
  channels_push: boolean;
  channels_sms: boolean;
  channels_siren: boolean;
  officer_id: string;
  audience_count: string | number;
  sms_recipient_count: string | number;
  estimated_reach: string | number | null;
  start_time: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  broadcast_at: Date | null;
}

const WARNING_COLUMNS = `
  SELECT id, warning_id, report_id, hazard_type, severity_level, target_district,
         safety_instructions, status, english_message, sinhala_message, tamil_message,
         channels_push, channels_sms, channels_siren, officer_id, audience_count,
         sms_recipient_count, estimated_reach, start_time, expires_at, created_at,
         updated_at, broadcast_at
    FROM disaster_warnings
`;

function channelsOf(row: WarningRow) {
  return { push: row.channels_push, sms: row.channels_sms, siren: row.channels_siren };
}

export function toWarning(row: WarningRow): DisasterWarning {
  return {
    id: row.id,
    warningId: row.warning_id,
    reportId: row.report_id,
    hazardType: row.hazard_type,
    severityLevel: row.severity_level,
    targetDistrict: row.target_district,
    safetyInstructions: row.safety_instructions ?? undefined,
    status: row.status as WarningStatus,
    englishMessage: row.english_message,
    sinhalaMessage: row.sinhala_message,
    tamilMessage: row.tamil_message,
    channels: channelsOf(row),
    officerId: row.officer_id,
    audienceCount: Number(row.audience_count),
    smsRecipientCount: Number(row.sms_recipient_count),
    estimatedReach:
      row.estimated_reach === null ? undefined : Number(row.estimated_reach),
    startTime: row.start_time ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    broadcastAt: row.broadcast_at ?? undefined,
  };
}

export async function insertWarning(
  warningId: string,
  officerId: string,
  reportInternalId: string,
  data: CreateDraftRequest,
  polygon: { coordinates: Coordinate[]; areaSqKm: number; overlapRatio?: number; source: BoundarySource }
): Promise<DisasterWarning> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO disaster_warnings (
          warning_id, report_id, hazard_type, severity_level, target_district,
          safety_instructions, status, english_message, sinhala_message, tamil_message,
          channels_push, channels_sms, channels_siren, officer_id, start_time, expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, $8, $9, $10, $11, $12, $13, NOW(), $14)
       RETURNING *`,
      [
        warningId,
        reportInternalId,
        data.hazardType,
        data.severityLevel,
        data.targetDistrict,
        data.safetyInstructions ?? null,
        data.englishMessage,
        data.sinhalaMessage,
        data.tamilMessage,
        data.channels.push,
        data.channels.sms,
        data.channels.siren,
        officerId,
        data.draftExpiresInHours
          ? new Date(Date.now() + data.draftExpiresInHours * 3_600_000)
          : null,
      ]
    );

    const warning = toWarning(result.rows[0] as WarningRow);

    await client.query(
      `INSERT INTO gis_polygons (
          warning_id, source, coordinates, area_sq_km, district_overlap_ratio, is_valid
       )
       VALUES ($1, $2, $3::jsonb, $4, $5, TRUE)`,
      [
        warning.id,
        polygon.source,
        JSON.stringify(polygon.coordinates),
        polygon.areaSqKm,
        polygon.overlapRatio ?? null,
      ]
    );

    await client.query(
      `INSERT INTO alert_payloads (warning_id, english_text, sinhala_text, tamil_text)
       VALUES ($1, $2, $3, $4)`,
      [warning.id, data.englishMessage, data.sinhalaMessage, data.tamilMessage]
    );

    await client.query("COMMIT");

    return warning;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findWarningByPublicId(
  warningId: string
): Promise<DisasterWarning | null> {
  const result = await pool.query(`${WARNING_COLUMNS} WHERE warning_id = $1 LIMIT 1`, [
    warningId,
  ]);

  const row = result.rows[0] as WarningRow | undefined;

  if (!row) {
    return null;
  }

  return hydrate(row);
}

export async function findWarningById(id: string): Promise<DisasterWarning | null> {
  const result = await pool.query(`${WARNING_COLUMNS} WHERE id = $1 LIMIT 1`, [id]);

  const row = result.rows[0] as WarningRow | undefined;

  return row ? hydrate(row) : null;
}

async function hydrate(row: WarningRow): Promise<DisasterWarning> {
  const [polygonResult, logResult] = await Promise.all([
    pool.query(
      `SELECT id, warning_id, source, coordinates, area_sq_km, district_overlap_ratio,
              is_valid, created_at
         FROM gis_polygons
        WHERE warning_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [row.id]
    ),
    pool.query(
      `SELECT id, warning_id, channel_type, status, dispatched_at, target_count,
              delivery_count, failure_count, error_message
         FROM broadcast_logs
        WHERE warning_id = $1
        ORDER BY dispatched_at ASC`,
      [row.id]
    ),
  ]);

  const warning = toWarning(row);

  const polygonRow = polygonResult.rows[0] as Row | undefined;

  if (polygonRow) {
    warning.gisPolygon = toPolygon(polygonRow);
  }

  warning.broadcastLogs = (logResult.rows as Row[]).map(toBroadcastLog);

  const report = await findReportById(row.report_id);

  if (report) {
    warning.report = report;
  }

  return warning;
}

function toPolygon(row: Row): GISPolygon {
  return {
    id: row.id as string,
    warningId: row.warning_id as string,
    source: row.source as BoundarySource,
    coordinates: normaliseCoordinates(row.coordinates),
    areaSqKm: Number(row.area_sq_km ?? 0),
    districtOverlapRatio:
      row.district_overlap_ratio === null ? undefined : Number(row.district_overlap_ratio),
    isValid: Boolean(row.is_valid),
    createdAt: row.created_at as Date,
  };
}

function normaliseCoordinates(value: unknown): Coordinate[] {
  const parsed = (typeof value === "string" ? JSON.parse(value) : value) as unknown;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map((item) => {
    if (Array.isArray(item)) {
      return { lat: Number(item[1]), lng: Number(item[0]) };
    }

    const point = item as Record<string, unknown>;

    return { lat: Number(point.lat), lng: Number(point.lng) };
  });
}

function toBroadcastLog(row: Row): BroadcastLog {
  return {
    id: row.id as string,
    warningId: row.warning_id as string,
    channelType: row.channel_type as ChannelType,
    status: row.status as BroadcastStatus,
    dispatchedAt: row.dispatched_at as Date,
    targetCount: Number(row.target_count ?? 0),
    deliveryCount: Number(row.delivery_count ?? 0),
    failureCount: Number(row.failure_count ?? 0),
    errorMessage: (row.error_message as string | null) ?? undefined,
  };
}

export async function listWarningsByOfficer(
  officerId: string,
  limit = 50
): Promise<DisasterWarning[]> {
  const result = await pool.query(
    `${WARNING_COLUMNS} WHERE officer_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [officerId, limit]
  );

  return Promise.all((result.rows as WarningRow[]).map(hydrate));
}

export async function listWarningsByReport(
  reportInternalId: string
): Promise<DisasterWarning[]> {
  const result = await pool.query(
    `${WARNING_COLUMNS} WHERE report_id = $1 ORDER BY created_at DESC`,
    [reportInternalId]
  );

  return Promise.all((result.rows as WarningRow[]).map(hydrate));
}

export async function updateWarning(
  id: string,
  officerId: string,
  data: Partial<CreateDraftRequest>,
  polygon?: {
    coordinates: Coordinate[];
    areaSqKm: number;
    overlapRatio?: number;
    source: BoundarySource;
  }
): Promise<DisasterWarning | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  const assign = (column: string, value: unknown): void => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (data.hazardType !== undefined) assign("hazard_type", data.hazardType);
  if (data.severityLevel !== undefined) assign("severity_level", data.severityLevel);
  if (data.targetDistrict !== undefined) assign("target_district", data.targetDistrict);
  if (data.safetyInstructions !== undefined)
    assign("safety_instructions", data.safetyInstructions);
  if (data.englishMessage !== undefined) assign("english_message", data.englishMessage);
  if (data.sinhalaMessage !== undefined) assign("sinhala_message", data.sinhalaMessage);
  if (data.tamilMessage !== undefined) assign("tamil_message", data.tamilMessage);
  if (data.channels?.push !== undefined) assign("channels_push", data.channels.push);
  if (data.channels?.sms !== undefined) assign("channels_sms", data.channels.sms);
  if (data.channels?.siren !== undefined) assign("channels_siren", data.channels.siren);

  params.push(id, officerId);

  if (sets.length === 0) {
    return findWarningById(id);
  }

  const result = await pool.query(
    `UPDATE disaster_warnings
        SET ${sets.join(", ")}, updated_at = NOW()
      WHERE id = $${params.length - 1} AND officer_id = $${params.length} AND status = 'DRAFT'
      RETURNING *`,
    params
  );

  const row = result.rows[0] as WarningRow | undefined;

  if (!row) {
    return null;
  }

  if (polygon) {
    await pool.query(`DELETE FROM gis_polygons WHERE warning_id = $1`, [id]);
    await pool.query(
      `INSERT INTO gis_polygons (
          warning_id, source, coordinates, area_sq_km, district_overlap_ratio, is_valid
       )
       VALUES ($1, $2, $3::jsonb, $4, $5, TRUE)`,
      [
        id,
        polygon.source,
        JSON.stringify(polygon.coordinates),
        polygon.areaSqKm,
        polygon.overlapRatio ?? null,
      ]
    );
  }

  if (
    data.englishMessage !== undefined ||
    data.sinhalaMessage !== undefined ||
    data.tamilMessage !== undefined
  ) {
    await pool.query(
      `UPDATE alert_payloads
          SET english_text = $2, sinhala_text = $3, tamil_text = $4
        WHERE warning_id = $1`,
      [id, row.english_message, row.sinhala_message, row.tamil_message]
    );
  }

  return hydrate(row);
}

export async function deleteDraft(id: string, officerId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM disaster_warnings
      WHERE id = $1 AND officer_id = $2 AND status = 'DRAFT'
      RETURNING id`,
    [id, officerId]
  );

  return Boolean(result.rows[0]);
}

/**
 * Draft -> live. Also stores the resolved audience numbers so the telemetry
 * screen can show exactly how many people were targeted.
 */
export async function markBroadcast(
  id: string,
  audience: { audienceCount: number; smsRecipientCount: number; estimatedReach: number }
): Promise<DisasterWarning | null> {
  const result = await pool.query(
    `UPDATE disaster_warnings
        SET status = 'ACTIVE',
            audience_count = $2,
            sms_recipient_count = $3,
            estimated_reach = $4,
            start_time = NOW(),
            broadcast_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, audience.audienceCount, audience.smsRecipientCount, audience.estimatedReach]
  );

  const row = result.rows[0] as WarningRow | undefined;

  return row ? hydrate(row) : null;
}

export async function changeStatus(
  id: string,
  status: WarningStatus
): Promise<DisasterWarning | null> {
  const result = await pool.query(
    `UPDATE disaster_warnings SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, status]
  );

  const row = result.rows[0] as WarningRow | undefined;

  return row ? hydrate(row) : null;
}

export async function insertBroadcastLogs(
  warningInternalId: string,
  logs: {
    channelType: ChannelType;
    status: BroadcastStatus;
    targetCount: number;
    deliveryCount: number;
    failureCount: number;
    errorMessage?: string;
  }[]
): Promise<void> {
  for (const log of logs) {
    await pool.query(
      `INSERT INTO broadcast_logs (
          warning_id, channel_type, status, target_count, delivery_count,
          failure_count, error_message
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        warningInternalId,
        log.channelType,
        log.status,
        log.targetCount,
        log.deliveryCount,
        log.failureCount,
        log.errorMessage ?? null,
      ]
    );
  }
}

/** Roles that live on the mobile app are the ones standing in the blast radius. */
export const ALERT_AUDIENCE_ROLES: UserRole[] = (
  Object.entries(ROLE_INTERFACES) as [UserRole, readonly string[]][]
)
  .filter(([, interfaces]) => interfaces.includes("MOBILE_APP"))
  .map(([role]) => role);

export interface AudienceRow extends AlertRecipient {
  latitude?: number;
  longitude?: number;
}

/**
 * "First check who is going to have the alerts" - resolve real accounts rather
 * than inventing delivery numbers.
 */
export async function findAlertAudience(district: string): Promise<AudienceRow[]> {
  const result = await pool.query(
    `SELECT id, phone_number, device_token, latitude, longitude
       FROM users
      WHERE status = 'ACTIVE'
        AND district = $1
        AND role = ANY($2)
        AND (device_token IS NOT NULL OR phone_number IS NOT NULL)
      ORDER BY created_at`,
    [district, ALERT_AUDIENCE_ROLES]
  );

  return (result.rows as Row[]).map((row) => ({
    userId: row.id as string,
    phoneNumber: (row.phone_number as string | null) ?? undefined,
    deviceToken: (row.device_token as string | null) ?? undefined,
    latitude: row.latitude === null ? undefined : Number(row.latitude),
    longitude: row.longitude === null ? undefined : Number(row.longitude),
  }));
}

/**
 * Expiry is swept lazily on read so an unanswered warning stops claiming to
 * be live without needing a scheduler.
 */
export async function expireOverdueWarnings(): Promise<number> {
  const result = await pool.query(
    `UPDATE disaster_warnings
        SET status = 'EXPIRED', updated_at = NOW()
      WHERE status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at < NOW()`
  );

  return result.rowCount ?? 0;
}

export interface CoverageRow {
  district: string | null;
  count: number;
}

/**
 * Coverage telemetry: how many alerted accounts sit in each district.
 */
export async function countAudienceByDistrict(): Promise<CoverageRow[]> {
  const result = await pool.query(
    `SELECT district, COUNT(*)::int AS count
       FROM users
      WHERE status = 'ACTIVE'
        AND role = ANY($1)
        AND (device_token IS NOT NULL OR phone_number IS NOT NULL)
      GROUP BY district
      ORDER BY count DESC`,
    [ALERT_AUDIENCE_ROLES]
  );

  return (result.rows as Row[]).map((row) => ({
    district: (row.district as string | null) ?? null,
    count: Number(row.count),
  }));
}

/**
 * The mobile app reports where it is and which device to wake up.
 */
export async function updateAlertTarget(
  userId: string,
  target: { deviceToken?: string; latitude?: number; longitude?: number }
): Promise<void> {
  await pool.query(
    `UPDATE users
        SET device_token = COALESCE($2, device_token),
            latitude = COALESCE($3::decimal, latitude),
            longitude = COALESCE($4::decimal, longitude),
            location_captured_at = CASE
                WHEN $3::decimal IS NULL THEN location_captured_at
                ELSE NOW()
            END
      WHERE id = $1`,
    [
      userId,
      target.deviceToken ?? null,
      target.latitude ?? null,
      target.longitude ?? null,
    ]
  );
}
