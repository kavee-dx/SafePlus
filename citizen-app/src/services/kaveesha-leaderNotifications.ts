import { useEffect, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import { saveAlertTarget } from "./dushani-alertApi";
import { fetchMyWorkspace, isLiveStatus } from "./kaveesha-leaderApi";

/* ------------------------------------------------------------------ *
 * Reaching a leader who is not looking at the screen (UC-03, mobile).
 *
 * This is the whole point of the phone being the leader's main surface: when a
 * district tasks a team, the leader is driving to a flood, not reading a laptop.
 * So a tasking has to make noise on its own.
 *
 * There are two layers here, deliberately:
 *   1. the remote push the backend sends to this handset's Expo token — the fast
 *      path, which is why the token is registered on entry (reusing the same
 *      device_token column the citizen alert feature already writes);
 *   2. a quiet poll of the leader's own board, which fires a local notification
 *      the moment a new mission appears — so a dropped push still ends with the
 *      leader being told, just a beat later.
 * ------------------------------------------------------------------ */

let handlerConfigured = false;

/**
 * Show an incoming SafePlus alert while the app is open, loudly. Called once from
 * the leader shell; safe to call again, it does nothing the second time.
 */
export function configureLeaderNotifications(): void {
  if (handlerConfigured) return;

  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // A leader mid-deployment should never have to open the app to see a tasking.
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Register this handset so the backend can push a tasking to it. Reuses the
 * citizen app's existing alert-target write, which stores the Expo token on the
 * user row — the exact column the dispatch push reads. Never throws: a phone that
 * cannot register should still let the leader use the app.
 */
export async function registerLeaderPushToken(token: string): Promise<void> {
  if (!Device.isDevice) return;

  try {
    const permission = await Notifications.getPermissionsAsync();

    if (!permission.granted) return;

    const registration = await Notifications.getExpoPushTokenAsync();

    await saveAlertTarget(token, { deviceToken: registration.data });
  } catch {
    // A registration failure is not worth interrupting a leader's work.
  }
}

/** Ask for notification permission once, quietly, and register the token. */
export async function enableLeaderNotifications(token: string): Promise<void> {
  configureLeaderNotifications();

  if (!Device.isDevice) return;

  try {
    const current = await Notifications.getPermissionsAsync();

    if (!current.granted) {
      await Notifications.requestPermissionsAsync();
    }
  } catch {
    // Permission prompts can fail on a simulator or without config; ignore.
  }

  await registerLeaderPushToken(token);
}

/** Post an urgent local alert on this handset. Used by the fallback watcher and
 *  by a stand-down the leader should see even with the app closed. */
export async function leadLocalAlert(
  title: string,
  body: string
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  } catch {
    // A local notification that cannot be scheduled is not worth a crash.
  }
}

/* A standby leader's board is polled this often for a tasking that never pushed. */
const TASKING_POLL_MS = 30_000;

/**
 * The safety net under the push. While the leader's shell is open this reads
 * their own board on a slow beat and, the first time a live mission shows up that
 * the leader has not been alerted about, rings it locally. It only ever compares
 * dispatch codes, so it never double-fires on the same tasking.
 */
export function useLeaderTaskingWatcher(
  token: string,
  onNewTasking?: (dispatchCode: string) => void
): void {
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const callback = useRef(onNewTasking);

  callback.current = onNewTasking;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const beat = async () => {
      try {
        const workspace = await fetchMyWorkspace(token);

        if (cancelled) return;

        const activeCode =
          workspace.active && isLiveStatus(workspace.active.status)
            ? workspace.active.dispatchCode
            : null;

        // The first read only seeds what is already there — a mission that was
        // live before the app opened is not a fresh tasking.
        if (!primed.current) {
          if (activeCode) seen.current.add(activeCode);
          primed.current = true;

          return;
        }

        if (activeCode && !seen.current.has(activeCode)) {
          seen.current.add(activeCode);
          callback.current?.(activeCode);
        }
      } catch {
        // A dropped beat is harmless; the next one tries again.
      }
    };

    void beat();

    const timer = setInterval(() => void beat(), TASKING_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);
}
