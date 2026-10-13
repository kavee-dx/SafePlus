import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LoginAccount } from "../services/dildhara-authApi";
import {
  LeaderApiError,
  type LeaderNotification,
  type LeaderWorkspace,
  type StageUpdate,
  ackShelterAssignment,
  advanceStage,
  fetchMyNotifications,
  fetchMyWorkspace,
  markNotificationRead,
  rejectShelterAssignment,
  reportShelterArrival,
} from "../services/kaveesha-leaderApi";
import {
  enableLeaderNotifications,
  leadLocalAlert,
  useLeaderTaskingWatcher,
} from "../services/kaveesha-leaderNotifications";
import KaveeshaLeaderMissionScreen from "./kaveesha-LeaderMissionScreen";
import KaveeshaLeaderHistoryScreen from "./kaveesha-LeaderHistoryScreen";
import KaveeshaLeaderNotificationsScreen from "./kaveesha-LeaderNotificationsScreen";
import KaveeshaLeaderTeamScreen from "./kaveesha-LeaderTeamScreen";

/* ------------------------------------------------------------------ *
 * The team leader's mobile command post (UC-03).
 *
 * This is the leader's main surface — the one they hold when they are driving
 * into a disaster with no laptop. It is a shell of three tabs: the live mission
 * with its one big next action, the ledger of past missions, and the team's own
 * standing state. It owns the workspace read so switching tabs never re-fetches
 * from scratch, and it keeps a fresh-enough picture on a slow beat while a
 * mission is live.
 * ------------------------------------------------------------------ */

type Tab = "mission" | "notifications" | "history" | "team";

interface LeaderAppProps {
  token: string;
  account: LoginAccount;
  onSignOut: () => void;
}

const LIVE_REFRESH_MS = 15_000;

export default function KaveeshaLeaderApp({
  token,
  account,
  onSignOut,
}: LeaderAppProps) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("mission");
  const [workspace, setWorkspace] = useState<LeaderWorkspace | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The standing message tray. Read once so the header badge is honest before
  // the leader ever taps it, and refreshed on the spot when it opens.
  const [notifications, setNotifications] = useState<LeaderNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyWorkspace(token)
      .then((data) => {
        setWorkspace(data);
        setError(null);
      })
      .catch((cause: LeaderApiError) => setError(cause.message))
      .finally(() => setReady(true));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const loadNotifications = useCallback(() => {
    setNotifLoading(true);

    fetchMyNotifications(token)
      .then((feed) => {
        setNotifications(feed.items);
        setNotifError(null);
      })
      .catch((cause: LeaderApiError) => setNotifError(cause.message))
      .finally(() => setNotifLoading(false));
  }, [token]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  /* Opening the tray is a footer-tab switch that pulls a fresh copy; a message
     the leader taps is marked read on the server and flipped in place so the
     badge drops without a full reload. */
  const openNotifications = useCallback(() => {
    setTab("notifications");
    loadNotifications();
  }, [loadNotifications]);

  const markRead = useCallback(
    (id: string) => {
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );

      markNotificationRead(token, id).catch(() => {
        // The optimistic flip stands; a lost write shows again on next open.
      });
    },
    [token]
  );

  /* One tap on a message: mark it read (its colour fades) and open the mission it
     points at. A leader holds at most one live mission, so the incident section is
     the Mission tab; once it is stood down there is no live dispatch and the tap
     lands on History instead. */
  const openNotification = useCallback(
    (item: LeaderNotification) => {
      if (!item.isRead) markRead(item.id);

      const live = workspace?.active && workspace.active.status !== "COMPLETED";

      setTab(live ? "mission" : "history");
    },
    [markRead, workspace]
  );

  /* Ask for notification permission and register this handset once, so the
     district's tasking push has somewhere to land. Safe to repeat; it never
     throws and never blocks the board. */
  useEffect(() => {
    void enableLeaderNotifications(token);
  }, [token]);

  // While a mission is live, keep the picture honest on a slow beat. When there is
  // nothing running there is nothing to refresh out from under the leader.
  useEffect(() => {
    const active = workspace?.active;

    if (!active || active.status === "COMPLETED") return;

    const timer = setInterval(() => load(), LIVE_REFRESH_MS);

    return () => clearInterval(timer);
  }, [workspace, load]);

  /* The push may be the fast path, but if it never landed this still rings the
     leader the moment a new mission shows up on their own board. */
  useLeaderTaskingWatcher(token, (dispatchCode) => {
    void leadLocalAlert(
      "New tasking",
      `You have been tasked as ${dispatchCode}. Open SafePlus to respond.`
    ).finally(() => {
      load();
      loadNotifications();
    });
  });

  const submitStage = async (update: StageUpdate) => {
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      await advanceStage(token, update);

      // Bring the picture back up to date: the stage just moved, and the legal
      // next stages changed with it.
      load();
    } catch (cause) {
      setError(
        cause instanceof LeaderApiError
          ? cause.message
          : "That update could not be sent. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  /* The leader's "we reached the shelter" tap. It flags the group on the server;
     we refresh so the board reflects any stage/group change, and hand the server's
     own message back to the card. Errors bubble to the card to show in place. Once
     the mission is completed there is no live dispatch, so the board's own mission
     id is passed — "current" would no longer resolve on the server. */
  const reportArrival = async (): Promise<string> => {
    const message = await reportShelterArrival(token, workspace?.active?.id);

    load();

    return message;
  };

  /* The leader accepts the shelter the district assigned and starts moving the
     group there (group -> IN_TRANSIT). Same id rule as the arrival report. */
  const ackShelter = async (): Promise<string> => {
    const message = await ackShelterAssignment(token, workspace?.active?.id);

    load();

    return message;
  };

  /* The leader declines the assigned shelter (it does not work for the people
     they have); the group goes back to the district to reassign. Same id rule. */
  const rejectShelter = async (): Promise<string> => {
    const message = await rejectShelterAssignment(token, workspace?.active?.id);

    load();

    return message;
  };

  const availabilityTone = toneForAvailability(workspace?.team.availability);
  const unreadNotifications = notifications.filter((item) => !item.isRead).length;

  if (!ready) {
    return (
      <View
        className="flex-1 items-center justify-center bg-safeplus-background"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator size="large" color="#1570EF" />
        <Text className="text-[13px] text-safeplus-muted mt-3">
          Opening your board…
        </Text>
      </View>
    );
  }

  if (!workspace) {
    return (
      <View
        className="flex-1 items-center justify-center px-8 bg-safeplus-background"
        style={{ paddingTop: insets.top }}
      >
        <Ionicons name="cloud-offline-outline" size={34} color="#98A2B3" />
        <Text className="text-[14px] text-safeplus-muted text-center mt-3 leading-5">
          {error ?? "Your mission board could not be read."}
        </Text>
        <Pressable
          onPress={load}
          className="mt-5 px-6 h-12 rounded-2xl bg-safeplus-navy items-center justify-center"
        >
          <Text className="text-white font-extrabold">Retry</Text>
        </Pressable>
        <Pressable onPress={onSignOut} className="mt-4 py-2">
          <Text className="text-[13px] font-semibold text-safeplus-muted underline">
            Sign out
          </Text>
        </Pressable>
      </View>
    );
  }

  /* The tray is a footer tab, so it shares the header and the bottom bar with
     every other surface rather than covering them. */
  return (
    <View className="flex-1 bg-safeplus-background">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 bg-safeplus-white border-b border-safeplus-border"
        style={{ paddingTop: insets.top + 10, paddingBottom: 10 }}
      >
        <View className="flex-1">
          <Text className="text-[17px] font-extrabold text-safeplus-navy" numberOfLines={1}>
            {workspace.team.name}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: availabilityTone }}
            />
            <Text className="text-[12px] font-semibold text-safeplus-muted">
              {prettyAvailability(workspace.team.availability)} · {account.fullName.split(" ")[0]}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={openNotifications}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            className="w-10 h-10 rounded-full bg-safeplus-background items-center justify-center active:opacity-80"
          >
            <View>
              <Ionicons name="notifications-outline" size={20} color="#667085" />
              {unreadNotifications > 0 && (
                <View className="absolute -right-1.5 -top-1 min-w-[16px] h-4 px-1 rounded-full bg-safeplus-red items-center justify-center">
                  <Text className="text-[9px] font-extrabold text-white">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>

          <Pressable
            onPress={onSignOut}
            accessibilityRole="button"
            className="w-10 h-10 rounded-full bg-safeplus-background items-center justify-center active:opacity-80"
          >
            <Ionicons name="log-out-outline" size={20} color="#667085" />
          </Pressable>
        </View>
      </View>

      {/* A soft error line that never covers the work */}
      {error && (
        <View className="px-4 py-2.5 bg-safeplus-lightRed">
          <Text className="text-[12.5px] font-semibold text-safeplus-red">{error}</Text>
        </View>
      )}

      {/* Body */}
      <View className="flex-1">
        {tab === "mission" && (
          <KaveeshaLeaderMissionScreen
            workspace={workspace}
            busy={busy}
            onStage={submitStage}
            onReportArrival={reportArrival}
            onAckShelter={ackShelter}
            onRejectShelter={rejectShelter}
          />
        )}
        {tab === "notifications" && (
          <KaveeshaLeaderNotificationsScreen
            items={notifications}
            loading={notifLoading}
            error={notifError}
            onOpen={openNotification}
            onRetry={loadNotifications}
          />
        )}
        {tab === "history" && (
          <KaveeshaLeaderHistoryScreen history={workspace.history} />
        )}
        {tab === "team" && (
          <KaveeshaLeaderTeamScreen
            token={token}
            notifications={notifications}
            onOpenNotifications={openNotifications}
            onOpen={openNotification}
          />
        )}
      </View>

      {/* Bottom tab bar */}
      <View
        className="flex-row bg-safeplus-white border-t border-safeplus-border"
        style={{ paddingBottom: insets.bottom + 8, paddingTop: 10 }}
      >
        <TabButton
          tab="mission"
          current={tab}
          icon="navigate-outline"
          label="Mission"
          badge={workspace.active && workspace.active.status !== "COMPLETED" ? 1 : 0}
          onPress={setTab}
        />
        <TabButton
          tab="notifications"
          current={tab}
          icon="notifications-outline"
          label="Alerts"
          badge={unreadNotifications}
          onPress={setTab}
        />
        <TabButton
          tab="history"
          current={tab}
          icon="time-outline"
          label="History"
          badge={workspace.history.length}
          onPress={setTab}
        />
        <TabButton
          tab="team"
          current={tab}
          icon="people-outline"
          label="Team"
          badge={0}
          onPress={setTab}
        />
      </View>
    </View>
  );
}

function TabButton({
  tab,
  current,
  icon,
  label,
  badge,
  onPress,
}: {
  tab: Tab;
  current: Tab;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge: number;
  onPress: (tab: Tab) => void;
}) {
  const on = current === tab;
  const color = on ? "#1570EF" : "#98A2B3";

  return (
    <Pressable
      onPress={() => onPress(tab)}
      accessibilityRole="button"
      className="flex-1 items-center justify-center py-1"
    >
      <View>
        <Ionicons name={icon} size={24} color={color} />
        {badge > 0 && (
          <View className="absolute -right-2 -top-1 min-w-[16px] h-4 px-1 rounded-full bg-safeplus-red items-center justify-center">
            <Text className="text-[9px] font-extrabold text-white">{badge}</Text>
          </View>
        )}
      </View>
      <Text className="text-[11px] font-bold mt-1" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

function prettyAvailability(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toneForAvailability(value: string | undefined): string {
  switch (value) {
    case "AVAILABLE":
      return "#16A34A";
    case "ON_DEPLOYMENT":
      return "#F79009";
    case "UNAVAILABLE":
      return "#98A2B3";
    default:
      return "#98A2B3";
  }
}
