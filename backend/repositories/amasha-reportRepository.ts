import type { PoolClient } from "pg";

import pool from "../config/db";
import {
  ADDITIONAL_INFO_REQUIRED,
  type DetailedReportInput,
  type EvidenceAttachment,
  type EvidenceInput,
  type ExtendedHazardReport,
  type ExtendedReportStatus,
} from "../models/amasha-hazardReportExt";

type Row = Record<string, unknown>;

interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

const EXTENDED_SELECT = `
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
         r.landmark,
         r.description,
         r.affected_population,
         r.immediate_danger,
         r.observed_at,
         r.status,
         r.verified_by,
         verifier.full_name AS verified_by_name,
         r.verified_at,
         r.verification_notes,
         r.info_request_reason,
         requester.full_name AS info_requested_by_name,
         r.info_requested_at,
         (SELECT COUNT(*) FROM disaster_warnings w WHERE w.report_id = r.id)::int
             AS warning_count,
         r.created_at,
         r.updated_at
    FROM hazard_reports r
    LEFT JOIN users u ON u.id = r.reporter_id
    LEFT JOIN users verifier ON verifier.id = r.verified_by
    LEFT JOIN users requester ON requester.id = r.info_requested_by
`;

function num(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : Number(value);
}

function date(value: unknown): Date | undefined {
  return value ? (value as Date) : undefined;
}

async function loadAttachments(
  reportId: string,
  client: Queryable = pool
): Promise<EvidenceAttachment[]> {
  const result = await client.query(
    `SELECT id, report_id, file_url, file_kind, content_type, created_at
       FROM report_attachments
      WHERE report_id = $1
      ORDER BY created_at ASC`,
    [reportId]
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    reportId: String(row.report_id),
    fileUrl: String(row.file_url),
    fileKind: (row.file_kind === "VIDEO" ? "VIDEO" : "PHOTO") as
      | "PHOTO"
      | "VIDEO",
    contentType: row.content_type ? String(row.content_type) : undefined,
    createdAt: row.created_at as Date,
  }));
}

async function toExtended(
  row: Row,
  client: Queryable = pool
): Promise<ExtendedHazardReport> {
  const attachments = await loadAttachments(String(row.id), client);

  return {
    id: String(row.id),
    reportId: String(row.report_id),
    reporterId: row.reporter_id ? String(row.reporter_id) : undefined,
    reporterName: row.reporter_name ? String(row.reporter_name) : undefined,
    reporterPhone: row.reporter_phone ? String(row.reporter_phone) : undefined,
    hazardType: String(row.hazard_type),
    severityLevel: String(row.severity_level),
    locationDistrict: String(row.location_district),
    locationLat: num(row.location_lat),
    locationLng: num(row.location_lng),
    landmark: row.landmark ? String(row.landmark) : undefined,
    description: String(row.description),
    affectedPopulation: num(row.affected_population),
    immediateDanger: Boolean(row.immediate_danger),
    observedAt: date(row.observed_at),
    status: row.status as ExtendedReportStatus,
    verifiedBy: row.verified_by ? String(row.verified_by) : undefined,
    verifiedByName: row.verified_by_name ? String(row.verified_by_name) : undefined,
    verifiedAt: date(row.verified_at),
    verificationNotes: row.verification_notes
      ? String(row.verification_notes)
      : undefined,
    infoRequestReason: row.info_request_reason
      ? String(row.info_request_reason)
      : undefined,
    infoRequestedByName: row.info_requested_by_name
      ? String(row.info_requested_by_name)
      : undefined,
    infoRequestedAt: date(row.info_requested_at),
    warningCount: num(row.warning_count) ?? 0,
    attachments,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

async function insertAttachments(
  reportId: string,
  attachments: EvidenceInput[],
  client: Queryable
): Promise<void> {
  for (const attachment of attachments) {
    await client.query(
      `INSERT INTO report_attachments (report_id, file_url, file_type, file_kind, content_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        reportId,
        attachment.dataUrl,
        attachment.contentType ?? null,
        attachment.fileKind,
        attachment.contentType ?? null,
      ]
    );
  }
}

/** First submission: report row + evidence in a single transaction. */
export async function createDetailedReport(
  reportId: string,
  reporterId: string,
  data: DetailedReportInput
): Promise<ExtendedHazardReport> {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      `INSERT INTO hazard_reports (
          report_id, reporter_id, hazard_type, severity_level, location_district,
          location_lat, location_lng, landmark, description, affected_population,
          immediate_danger, observed_at, status
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'PENDING_VERIFICATION')
       RETURNING id`,
      [
        reportId,
        reporterId,
        data.hazardType,
        data.severityLevel,
        data.locationDistrict,
        data.locationLat ?? null,
        data.locationLng ?? null,
        data.landmark ?? null,
        data.description,
        data.affectedPopulation ?? null,
        data.immediateDanger ?? false,
        data.observedAt,
      ]
    );

    const id = String(inserted.rows[0].id);

    await insertAttachments(id, data.attachments ?? [], client);

    const fetched = await client.query(`${EXTENDED_SELECT} WHERE r.id = $1 LIMIT 1`, [
      id,
    ]);

    await client.query("COMMIT");

    return await toExtended(fetched.rows[0], client);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findDetailById(
  id: string
): Promise<ExtendedHazardReport | null> {
  const result = await pool.query(`${EXTENDED_SELECT} WHERE r.id = $1 LIMIT 1`, [
    id,
  ]);

  return result.rows[0] ? toExtended(result.rows[0]) : null;
}

export async function findDetailByPublicId(
  reportId: string
): Promise<ExtendedHazardReport | null> {
  const result = await pool.query(
    `${EXTENDED_SELECT} WHERE r.report_id = $1 LIMIT 1`,
    [reportId]
  );

  return result.rows[0] ? toExtended(result.rows[0]) : null;
}

export async function listExtended(
  status: ExtendedReportStatus,
  options: { district?: string; limit?: number } = {}
): Promise<ExtendedHazardReport[]> {
  const params: unknown[] = [status];
  let sql = `${EXTENDED_SELECT} WHERE r.status = $1`;

  if (options.district) {
    params.push(options.district);
    sql += ` AND r.location_district = $${params.length}`;
  }

  params.push(options.limit ?? 100);
  sql += ` ORDER BY r.created_at DESC LIMIT $${params.length}`;

  const result = await pool.query(sql, params);
  const reports: ExtendedHazardReport[] = [];

  for (const row of result.rows) {
    reports.push(await toExtended(row));
  }

  return reports;
}

export async function listExtendedByReporter(
  reporterId: string,
  limit = 50
): Promise<ExtendedHazardReport[]> {
  const result = await pool.query(
    `${EXTENDED_SELECT} WHERE r.reporter_id = $1 ORDER BY r.created_at DESC LIMIT $2`,
    [reporterId, limit]
  );

  const reports: ExtendedHazardReport[] = [];

  for (const row of result.rows) {
    reports.push(await toExtended(row));
  }

  return reports;
}

/** A2: park the report and record why the officer needs more from the citizen. */
export async function requestMoreInfo(
  id: string,
  officerId: string,
  reason: string
): Promise<ExtendedHazardReport | null> {
  const result = await pool.query(
    `UPDATE hazard_reports
        SET status = $2,
            info_request_reason = $3,
            info_requested_by = $4,
            info_requested_at = NOW(),
            updated_at = NOW()
      WHERE id = $1 AND status = 'PENDING_VERIFICATION'
      RETURNING id`,
    [id, ADDITIONAL_INFO_REQUIRED, reason, officerId]
  );

  return result.rows[0] ? findDetailById(String(result.rows[0].id)) : null;
}

/** A2: the citizen answers and the report goes back to the verification queue. */
export async function resubmitReport(
  id: string,
  data: DetailedReportInput
): Promise<ExtendedHazardReport | null> {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const updated = await client.query(
      `UPDATE hazard_reports
          SET hazard_type = $2,
              severity_level = $3,
              location_district = $4,
              location_lat = $5,
              location_lng = $6,
              landmark = $7,
              description = $8,
              affected_population = $9,
              immediate_danger = $10,
              observed_at = $11,
              status = 'PENDING_VERIFICATION',
              updated_at = NOW()
        WHERE id = $1 AND status = $12
        RETURNING id`,
      [
        id,
        data.hazardType,
        data.severityLevel,
        data.locationDistrict,
        data.locationLat ?? null,
        data.locationLng ?? null,
        data.landmark ?? null,
        data.description,
        data.affectedPopulation ?? null,
        data.immediateDanger ?? false,
        data.observedAt,
        ADDITIONAL_INFO_REQUIRED,
      ]
    );

    if (!updated.rows[0]) {
      await client.query("ROLLBACK");

      return null;
    }

    await insertAttachments(id, data.attachments ?? [], client);

    const fetched = await client.query(`${EXTENDED_SELECT} WHERE r.id = $1 LIMIT 1`, [
      id,
    ]);

    await client.query("COMMIT");

    return await toExtended(fetched.rows[0], client);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface ReportNotification {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  relatedReportId?: string;
}

/**
 * Own insert rather than the dushani helper so the new REPORT_INFO_REQUESTED
 * type does not force an edit to the shared NotificationType enum.
 */
export async function insertReportNotifications(
  entries: ReportNotification[]
): Promise<void> {
  for (const entry of entries) {
    await pool.query(
      `INSERT INTO notifications (recipient_id, type, title, message, related_report_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        entry.recipientId,
        entry.type,
        entry.title,
        entry.message,
        entry.relatedReportId ?? null,
      ]
    );
  }
}
