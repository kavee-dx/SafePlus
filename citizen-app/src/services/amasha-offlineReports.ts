import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  AlertApiError,
  submitDetailedReport,
  type DetailedReportPayload,
} from "./amasha-reportApi";

const STORAGE_PREFIX = "amasha-pending-reports:";

export interface OfflineDraft {
  id: string;
  payload: DetailedReportPayload;
  savedAt: string;
  status: "PENDING_SYNCHRONIZATION";
}

function storageKey(userKey: string): string {
  return `${STORAGE_PREFIX}${userKey}`;
}

async function readAll(userKey: string): Promise<OfflineDraft[]> {
  const raw = await AsyncStorage.getItem(storageKey(userKey));

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as OfflineDraft[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(userKey: string, drafts: OfflineDraft[]): Promise<void> {
  await AsyncStorage.setItem(storageKey(userKey), JSON.stringify(drafts));
}

export async function listOfflineReports(userKey: string): Promise<OfflineDraft[]> {
  return readAll(userKey);
}

export async function saveOfflineReport(
  userKey: string,
  payload: DetailedReportPayload
): Promise<OfflineDraft> {
  const draft: OfflineDraft = {
    id: `OFFLINE-${Date.now().toString(36).toUpperCase()}`,
    payload,
    savedAt: new Date().toISOString(),
    status: "PENDING_SYNCHRONIZATION",
  };

  const existing = await readAll(userKey);

  await writeAll(userKey, [draft, ...existing]);

  return draft;
}

export async function removeOfflineReport(
  userKey: string,
  id: string
): Promise<void> {
  const remaining = (await readAll(userKey)).filter((item) => item.id !== id);

  await writeAll(userKey, remaining);
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
  const drafts = await readAll(userKey);
  let sent = 0;
  let lastError: string | undefined;
  const leftover: OfflineDraft[] = [];

  for (const draft of drafts) {
    try {
      await submitDetailedReport(token, draft.payload);
      sent += 1;
    } catch (error) {
      leftover.push(draft);
      lastError =
        error instanceof AlertApiError
          ? error.message
          : "A saved report could not be sent.";
    }
  }

  await writeAll(userKey, leftover);

  return { sent, remaining: leftover.length, lastError };
}

export function isUnreachable(error: unknown): boolean {
  return error instanceof AlertApiError && error.status === null;
}
