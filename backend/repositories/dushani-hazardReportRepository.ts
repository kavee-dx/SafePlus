import pool from "../config/db";
import type { PoolClient } from "pg";
import {
  NotificationType,
  ReportStatus,
  type CreateReportRequest,
  type HazardReport,
  type Notification,
} from "../models/hazardReport";

export type Row = Record<string, unknown>;

interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

interface ReportRow extends Row {
  id: string;
  report_id: string;
  reporter_id: string | null;
  reporter_name: string | null;
  reporter_phone: string | null;
  hazard_type: string;
  severity_level: string;
  location_district: string;
  location_lat: string | number | null;
  location_lng: string | number | null;
  description: string;
  affected_population: string | number | null;
  status: string;
  verified_by: string | null;
  verified_at: Date | null;
  verification_notes: string | null;
  warning_count: string | number | null;
  created_at: Date;
  updated_at: Date;
}

const REPORT_SELECT = `
  SELECT r.id,
         r.report_id,
         r.reporter_id,
         u.full_name AS reporter_name,
         u.phone_number AS reporter_phone,
         r.hazard_type,
         r.severity_level,
         r.location_district,
         r.location_lat,
         r.location_lng,
         r.description,
         r.affected_population,
         r.status,
         r.verified_by,
         r.verified_at,
         r.verification_notes,
         (SELECT COUNT(*) FROM disaster_warnings w WHERE w.report_id = r.id)::int
             AS warning_count,
         r.created_at,
         r.updated_at
    FROM hazard_reports r
    LEFT JOIN users u ON u.id = r.reporter_id
`;

function decimal(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return Number(value);
}

export function toReport(row: ReportRow): HazardReport {
  return {
    id: row.id,
    reportId: row.report_id,
    reporterId: row.reporter_id ?? undefined,
    reporterName: row.reporter_name ?? undefined,
    reporterPhone: row.reporter_phone ?? undefined,
    hazardType: row.hazard_type,
    severityLevel: row.severity_level,
    locationDistrict: row.location_district,
    locationLat: decimal(row.location_lat),
    locationLng: decimal(row.location_lng),
    description: row.description,
    affectedPopulation: decimal(row.affected_population),
    status: row.status as ReportStatus,
    verifiedBy: row.verified_by ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
    verificationNotes: row.verification_notes ?? undefined,
    warningCount: decimal(row.warning_count) ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertReport(
  reportId: string,
  reporterId: string,
  data: CreateReportRequest,
  client: Queryable = pool
): Promise<HazardReport> {
  const result = await client.query(
    `INSERT INTO hazard_reports (
        report_id, reporter_id, hazard_type, severity_level, location_district,
        location_lat, location_lng, description, affected_population, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_VERIFICATION')
     RETURNING id`,
    [
      reportId,
      reporterId,
      data.hazardType,
      data.severityLevel,
      data.locationDistrict,
      data.locationLat ?? null,
      data.locationLng ?? null,
      data.description,
      data.affectedPopulation ?? null,
    ]
  );

  return (await findReportById(result.rows[0].id as string, client))!;
}

export async function findReportById(
  id: string,
  client: Queryable = pool
): Promise<HazardReport | null> {
  const result = await client.query(`${REPORT_SELECT} WHERE r.id = $1 LIMIT 1`, [id]);

  return result.rows[0] ? toReport(result.rows[0] as ReportRow) : null;
}

/**
 * Officers work with the human readable RPT-... id, so every public lookup
 * accepts that and resolves the internal uuid from it.
 */
export async function findReportByPublicId(
  reportId: string,
  client: Queryable = pool
): Promise<HazardReport | null> {
  const result = await client.query(
    `${REPORT_SELECT} WHERE r.report_id = $1 LIMIT 1`,
    [reportId]
  );

  return result.rows[0] ? toReport(result.rows[0] as ReportRow) : null;
}

export async function listReports(
  status: ReportStatus,
  options: { district?: string; limit?: number } = {}
): Promise<HazardReport[]> {
  const params: unknown[] = [status];
  let sql = `${REPORT_SELECT} WHERE r.status = $1`;

  if (options.district) {
    params.push(options.district);
    sql += ` AND r.location_district = $${params.length}`;
  }

  params.push(options.limit ?? 100);
  sql += ` ORDER BY r.created_at DESC LIMIT $${params.length}`;

  const result = await pool.query(sql, params);

  return (result.rows as ReportRow[]).map(toReport);
}

export async function listReportsByReporter(
  reporterId: string,
  limit = 50
): Promise<HazardReport[]> {
  const result = await pool.query(
    `${REPORT_SELECT} WHERE r.reporter_id = $1 ORDER BY r.created_at DESC LIMIT $2`,
    [reporterId, limit]
  );

  return (result.rows as ReportRow[]).map(toReport);
}

export async function updateVerification(
  internalId: string,
  verifierId: string,
  status: ReportStatus.VERIFIED | ReportStatus.REJECTED,
  verificationNotes?: string
): Promise<HazardReport | null> {
  const result = await pool.query(
    `UPDATE hazard_reports
        SET status = $2,
            verified_by = $3,
            verified_at = CASE WHEN $2::varchar = 'VERIFIED' THEN NOW() ELSE NULL END,
            verification_notes = $4,
            updated_at = NOW()
      WHERE id = $1
      RETURNING id`,
    [internalId, status, verifierId, verificationNotes ?? null]
  );

  if (!result.rows[0]) {
    return null;
  }

  return findReportById(result.rows[0].id as string);
}

export interface NotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedReportId?: string;
  relatedWarningId?: string;
}

interface NotificationRow {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  related_report_id: string | null;
  related_warning_id: string | null;
  created_at: Date;
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    type: row.type as NotificationType,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    relatedReportId: row.related_report_id ?? undefined,
    relatedWarningId: row.related_warning_id ?? undefined,
    createdAt: row.created_at,
  };
}

export async function insertNotifications(
  entries: NotificationInput[],
  client: PoolClient | undefined = undefined
): Promise<number> {
  if (entries.length === 0) {
    return 0;
  }

  const executor: Queryable = client ?? pool;

  for (const entry of entries) {
    await executor.query(
      `INSERT INTO notifications (
          recipient_id, type, title, message, related_report_id, related_warning_id
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.recipientId,
        entry.type,
        entry.title,
        entry.message,
        entry.relatedReportId ?? null,
        entry.relatedWarningId ?? null,
      ]
    );
  }

  return entries.length;
}

export async function listNotifications(
  recipientId: string,
  limit = 50
): Promise<Notification[]> {
  const result = await pool.query(
    `SELECT id, recipient_id, type, title, message, is_read,
            related_report_id, related_warning_id, created_at
       FROM notifications
      WHERE recipient_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [recipientId, limit]
  );

  return (result.rows as NotificationRow[]).map(toNotification);
}

export async function countUnreadNotifications(
  recipientId: string
): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM notifications
      WHERE recipient_id = $1 AND is_read = FALSE`,
    [recipientId]
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function markNotificationRead(
  notificationId: string,
  recipientId: string
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE notifications
        SET is_read = TRUE
      WHERE id = $1 AND recipient_id = $2 AND is_read = FALSE
      RETURNING id`,
    [notificationId, recipientId]
  );

  return Boolean(result.rows[0]);
}

/**
 * Who has to see a new report / a newly verified report: every active DMC
 * officer (any of them may raise the warning) plus the district officers
 * covering the reported district.
 */
export async function findVerificationRecipients(
  district: string
): Promise<string[]> {
  const result = await pool.query(
    `SELECT u.id
       FROM users u
       JOIN dmc_officers o ON o.user_id = u.id
      WHERE u.status = 'ACTIVE'
     UNION
     SELECT u.id
       FROM users u
       JOIN district_officers o ON o.user_id = u.id
      WHERE u.status = 'ACTIVE' AND o.assigned_district = $1`,
    [district]
  );

  return result.rows.map((row: { id: string }) => row.id);
}

export async function isDmcOfficer(userId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM dmc_officers o
       JOIN users u ON u.id = o.user_id
      WHERE o.user_id = $1 AND u.status = 'ACTIVE'
      LIMIT 1`,
    [userId]
  );

  return Boolean(result.rows[0]);
}
