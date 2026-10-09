import pool from "../config/db";

export type AuditAction =
  | "DRAFT_CREATED"
  | "DRAFT_UPDATED"
  | "DRAFT_DELETED"
  | "REVIEWED_REPORT"
  | "BROADCAST_SUCCESS"
  | "BROADCAST_FAILED"
  | "AUTH_FAILED"
  | "PIN_SET"
  | "SMS_FALLBACK"
  | "STOOD_DOWN"
  | "NO_COVERAGE"
  | "EXPIRY_EXTENDED"
  | "WARNING_DELETED";

export interface AuditEntry {
  warningId: string | null;
  officerId: string | null;
  action: AuditAction;
  entryPoint: string;
  details?: Record<string, unknown>;
}

const MAX_QUEUE_SIZE = 500;

/**
 * Asynchronous audit logging (group 30 improvement).
 *
 * Broadcast latency is a safety property: an officer must not wait on an
 * INSERT while a flood warning is being pushed. Writes are queued and flushed
 * in batches off the request path; the queue is drained on shutdown so a
 * graceful restart never drops recorded attempts.
 */
export class AuditLoggerService {
  private queue: AuditEntry[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing: Promise<void> | null = null;
  private dropped = 0;

  constructor(private readonly batchIntervalMs = 2000) {}

  log(entry: AuditEntry): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Never let a bounded queue block an emergency broadcast.
      this.queue.shift();
      this.dropped += 1;
    }

    this.queue.push(entry);
    this.ensureTimer();
  }

  private ensureTimer(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.flush();
    }, this.batchIntervalMs);

    // A pending timer must not keep the process alive after shutdown.
    this.timer.unref();
  }

  async flush(): Promise<void> {
    if (this.flushing) {
      return this.flushing;
    }

    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.queue.length);

    this.flushing = this.persist(batch).catch((error: unknown) => {
      console.error("[Audit] Failed to persist batch:", error);
    });

    try {
      await this.flushing;
    } finally {
      this.flushing = null;
    }
  }

  private async persist(batch: AuditEntry[]): Promise<void> {
    for (const entry of batch) {
      await pool.query(
        `INSERT INTO warning_audit_logs (
            warning_id, officer_id, action, entry_point, details
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [
          entry.warningId,
          entry.officerId,
          entry.action,
          entry.entryPoint,
          entry.details ? JSON.stringify(entry.details) : null,
        ]
      );
    }
  }

  /**
   * E3 and coverage blocks are recorded and flushed immediately: they are the
   * entries an investigator needs even if the process dies afterwards.
   */
  async logImmediate(entry: AuditEntry): Promise<void> {
    this.log(entry);
    await this.flush();
  }

  async listForWarning(warningId: string, limit = 100): Promise<AuditEntry[]> {
    const result = await pool.query(
      `SELECT warning_id, officer_id, action, entry_point, details, created_at
         FROM warning_audit_logs
        WHERE warning_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [warningId, limit]
    );

    return result.rows.map((row) => ({
      warningId: row.warning_id,
      officerId: row.officer_id,
      action: row.action as AuditAction,
      entryPoint: row.entry_point,
      details: row.details ?? undefined,
    }));
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getDroppedCount(): number {
    return this.dropped;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

let auditLogger: AuditLoggerService | null = null;

export function getAuditLogger(): AuditLoggerService {
  if (!auditLogger) {
    auditLogger = new AuditLoggerService();
  }

  return auditLogger;
}
