import { isNetworkAvailable, subscribeToNetworkRestored } from "./amasha-network";
import { listOfflineReports, syncOfflineReports } from "./amasha-offlineReports";

/**
 * E1: keep a single in-app listener so a restored connection flushes
 * Pending Synchronization reports without touching other screens.
 */
export function startOfflineSync(token: string, userKey: string): () => void {
  let cancelled = false;
  let inFlight = false;

  const run = async () => {
    if (cancelled || inFlight) {
      return;
    }

    const waiting = await listOfflineReports(userKey);

    if (waiting.length === 0) {
      return;
    }

    if (!(await isNetworkAvailable())) {
      return;
    }

    inFlight = true;

    try {
      await syncOfflineReports(token, userKey);
    } catch {
      // Leave drafts queued; the next connectivity event retries.
    } finally {
      inFlight = false;
    }
  };

  void run();

  const stopListening = subscribeToNetworkRestored(() => {
    void run();
  });

  return () => {
    cancelled = true;
    stopListening();
  };
}
