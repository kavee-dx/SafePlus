import { AlertApiError } from "./dushani-alertApi";
import {
  submitDetailedReport,
  type DetailedReportPayload,
} from "./amasha-reportApi";
import { isNetworkAvailable } from "./amasha-network";
import {
  deleteSecureDraft,
  insertSecureDraft,
  listSecureDrafts,
  PENDING_SYNCHRONIZATION,
  type OfflineDraft,
} from "./amasha-secureReportStore";

export type { OfflineDraft };
export { PENDING_SYNCHRONIZATION };

export async function listOfflineReports(userKey: string): Promise<OfflineDraft[]> {
  return listSecureDrafts(userKey);
}

export async function saveOfflineReport(
  userKey: string,
  payload: DetailedReportPayload
): Promise<OfflineDraft> {
  return insertSecureDraft(userKey, payload);
}

export async function removeOfflineReport(
  userKey: string,
  id: string
): Promise<void> {
  await deleteSecureDraft(userKey, id);
}

export interface SyncResult {
  sent: number;
  remaining: number;
  lastError?: string;
}

/** E1: when the network returns, push each locally stored report to the server. */
export async function syncOfflineReports(
  token: string,
  userKey: string
): Promise<SyncResult> {
  const drafts = await listSecureDrafts(userKey);

  if (drafts.length === 0) {
    return { sent: 0, remaining: 0 };
  }

  if (!(await isNetworkAvailable())) {
    return {
      sent: 0,
      remaining: drafts.length,
      lastError: "Network is still unavailable. Reports stay Pending Synchronization.",
    };
  }

  let sent = 0;
  let lastError: string | undefined;

  for (const draft of drafts) {
    try {
      await submitDetailedReport(token, draft.payload);
      await deleteSecureDraft(userKey, draft.id);
      sent += 1;
    } catch (error) {
      lastError =
        error instanceof AlertApiError
          ? error.message
          : "A saved report could not be sent.";

      if (isUnreachable(error)) {
        break;
      }
    }
  }

  const remaining = (await listSecureDrafts(userKey)).length;

  return { sent, remaining, lastError };
}

export function isUnreachable(error: unknown): boolean {
  return error instanceof AlertApiError && error.status === null;
}
