import pool from "../config/db";
import type { AlertSmsMessage, NewAlertSms } from "../models/alertSms";

type Row = Record<string, unknown>;

/**
 * Hands the composed SMS to the recipient's message store. Re-broadcasting the
 * same warning to the same phone is a no-op, so a retried dispatch can never
 * give a citizen two copies of one emergency alert.
 */
export async function insertAlertSms(entries: NewAlertSms[]): Promise<number> {
  if (entries.length === 0) {
    return 0;
  }

  const params: unknown[] = [];
  const tuples: string[] = [];

  for (const entry of entries) {
    params.push(
      entry.warningInternalId,
      entry.recipientId,
      entry.senderId,
      entry.levelLabel,
      entry.areaLabel,
      entry.instruction,
      entry.body
    );

    const base = params.length - 7;

    tuples.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`
    );
  }

  const result = await pool.query(
    `INSERT INTO alert_sms_messages (
        warning_id, recipient_id, sender_id, level_label, area_label,
        instruction, body
     )
     VALUES ${tuples.join(", ")}
     ON CONFLICT (warning_id, recipient_id) DO NOTHING
     RETURNING id`,
    params
  );

  return result.rowCount ?? 0;
}

export async function listAlertSms(
  recipientId: string,
  limit = 30
): Promise<AlertSmsMessage[]> {
  const result = await pool.query(
    `SELECT m.id, w.warning_id, m.sender_id, m.level_label, m.area_label,
            m.instruction, m.body, m.delivered_at, m.read_at,
            w.status AS warning_status, w.hazard_type, w.severity_level,
            w.target_district, w.expires_at
       FROM alert_sms_messages m
       JOIN disaster_warnings w ON w.id = m.warning_id
      WHERE m.recipient_id = $1
      ORDER BY m.delivered_at DESC
      LIMIT $2`,
    [recipientId, limit]
  );

  return (result.rows as Row[]).map((row) => ({
    id: row.id as string,
    warningId: row.warning_id as string,
    senderId: row.sender_id as string,
    levelLabel: row.level_label as string,
    areaLabel: row.area_label as string,
    instruction: row.instruction as string,
    body: row.body as string,
    deliveredAt: row.delivered_at as Date,
    readAt: (row.read_at as Date | null) ?? undefined,
    warningStatus: row.warning_status as string,
    hazardType: row.hazard_type as string,
    severityLevel: row.severity_level as string,
    targetDistrict: row.target_district as string,
    expiresAt: (row.expires_at as Date | null) ?? undefined,
  }));
}

export async function markAlertSmsRead(
  id: string,
  recipientId: string
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE alert_sms_messages
        SET read_at = COALESCE(read_at, NOW())
      WHERE id = $1 AND recipient_id = $2
      RETURNING id`,
    [id, recipientId]
  );

  return Boolean(result.rows[0]);
}
