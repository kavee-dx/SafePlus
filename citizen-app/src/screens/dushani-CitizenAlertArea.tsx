import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  Text,
  View,
  type TextStyle,
} from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchAlertInbox,
  saveAlertTarget,
  type DeliveredAlert,
} from "../services/dushani-alertApi";
import type { LoginAccount } from "../services/dildhara-authApi";
import HomeScreen from "./dildhara-HomeScreen";
import AlertInboxScreen from "./dushani-AlertInboxScreen";
import MyReportsScreen from "./amasha-MyReportsScreen";
import ReportHazardScreen from "./amasha-ReportHazardScreen";
import { syncOfflineReports } from "../services/amasha-offlineReports";

type Overlay = "none" | "report" | "mine" | "alerts";
type PushState = "unknown" | "ready" | "blocked" | "unsupported";

/** An emergency text is worth waiting for, but not worth a websocket. */
const INBOX_POLL_MS = 20_000;

/** Android 8+ drops a notification that has no channel to land in. */
const ALERT_CHANNEL_ID = "dmc-alerts";

/** Fixed-width digits so a count badge never jitters as it changes. */
const tabular: TextStyle = { fontVariant: ["tabular-nums"] };

let alertChannelReady: Promise<void> | null = null;

/** Creating the channel is idempotent, but it is still only done once. */
function ensureAlertChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return Promise.resolve();
  }

  alertChannelReady ??= Notifications.setNotificationChannelAsync(
    ALERT_CHANNEL_ID,
    {
      name: "DMC alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#D92D20",
    }
  ).then(() => undefined);

  return alertChannelReady;
}

// A broadcast is an emergency warning even while the app is open, so it is
// never silently swallowed by the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface CitizenAlertAreaProps {
  token: string;
  account: LoginAccount;
  onSignOut: () => void;
}

export default function CitizenAlertArea({
  token,
  account,
  onSignOut,
}: CitizenAlertAreaProps) {
  const insets = useSafeAreaInsets();
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [updateReportId, setUpdateReportId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveCount, setLiveCount] = useState(0);
  const [pollToken, setPollToken] = useState(0);
  const [pushState, setPushState] = useState<PushState>("unknown");
  const [pushReason, setPushReason] = useState<string | null>(null);

  const seenAlerts = useRef<Set<string>>(new Set());
  const inboxSeeded = useRef(false);

  /**
   * Expo Go on Android cannot receive a remote push, so the inbox poll raises
   * a local notification itself. Without this a broadcast that is already on
   * the phone stays silent until somebody opens the app.
   */
  const announceArrivals = useCallback(async (alerts: DeliveredAlert[]) => {
    // The first read is history the phone already holds; only an arrival buzzes.
    if (!inboxSeeded.current) {
      alerts.forEach((alert) => seenAlerts.current.add(alert.id));
      inboxSeeded.current = true;

      return;
    }

    const arrivals = alerts.filter(
      (alert) => !seenAlerts.current.has(alert.id)
    );

    arrivals.forEach((alert) => seenAlerts.current.add(alert.id));

    for (const alert of arrivals) {
      try {
        await ensureAlertChannel();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "DMC emergency alert",
            body: `${alert.levelLabel}\n${alert.areaLabel}\n${alert.instruction}`,
            data: { warningId: alert.warningId },
          },
          trigger:
            Platform.OS === "android"
              ? { channelId: ALERT_CHANNEL_ID }
              : null,
        });
      } catch {
        // A handset that refuses the notification still shows the alert in the
        // inbox, so the badge and list must not depend on it.
      }
    }
  }, []);

  // Without a push token this phone is invisible to a district broadcast. The
  // token only exists once notifications are allowed and, on Android, once the
  // channel the payload names actually exists, so all three steps run here.
  useEffect(() => {
    if (!Device.isDevice) {
      setPushState("unsupported");
      return;
    }

    let cancelled = false;

    const blocked = (reason: string) => {
      if (cancelled) return;

      setPushState("blocked");
      setPushReason(reason);
    };

    Notifications.requestPermissionsAsync()
      .then(({ status }) => {
        if (status !== "granted") {
          blocked("Notifications are not allowed for SafePlus on this phone.");

          return null;
        }

        return ensureAlertChannel()
          .then(() => Notifications.getExpoPushTokenAsync())
          .then((registration) =>
            saveAlertTarget(token, { deviceToken: registration.data }).then(
              () => registration
            )
          );
      })
      .then((registration) => {
        if (!cancelled && registration) {
          setPushState("ready");
          setPushReason(null);
        }
      })
      .catch((registrationError: unknown) => {
        // A swallowed failure looks identical to a working setup, so the reason
        // the handset could not register is kept and shown instead of dropped.
        blocked(
          registrationError instanceof Error
            ? registrationError.message
            : "This phone could not register for remote push."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Listen for incoming push notifications
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      // Refresh the inbox when a notification is received
      setPollToken((current) => current + 1);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      () => {
        // Open the alert inbox when user taps the notification
        setOverlay("alerts");
      }
    );

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchAlertInbox(token)
      .then((inbox) => {
        if (cancelled) return;

        setUnreadCount(inbox.unreadCount);
        setLiveCount(
          inbox.alerts.filter((alert) => alert.warningStatus === "ACTIVE").length
        );
        void announceArrivals(inbox.alerts);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [token, pollToken, announceArrivals]);

  useEffect(() => {
    const timer = setInterval(
      () => setPollToken((current) => current + 1),
      INBOX_POLL_MS
    );

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void syncOfflineReports(token, account.id).catch(() => undefined);
  }, [token, account.id, pollToken]);

  // A broadcast should land like a system warning, so the banner slides in
  // instead of simply appearing already on screen.
  const bannerVisible = unreadCount > 0;
  const bannerEntrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!bannerVisible) {
      bannerEntrance.setValue(0);

      return;
    }

    Animated.spring(bannerEntrance, {
      toValue: 1,
      friction: 9,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [bannerVisible, bannerEntrance]);

  if (overlay === "alerts") {
    return (
      <AlertInboxScreen
        token={token}
        pushState={pushState}
        pushReason={pushReason}
        onBack={() => {
          setOverlay("none");
          setPollToken((current) => current + 1);
        }}
      />
    );
  }

  if (overlay === "report") {
    return (
      <ReportHazardScreen
        token={token}
        userKey={account.id}
        updateReportId={updateReportId}
        onBack={() => {
          setUpdateReportId(null);
          setOverlay("none");
        }}
        onViewReports={() => {
          setUpdateReportId(null);
          setOverlay("mine");
        }}
      />
    );
  }

  if (overlay === "mine") {
    return (
      <MyReportsScreen
        token={token}
        userKey={account.id}
        onBack={() => setOverlay("none")}
        onNewReport={() => {
          setUpdateReportId(null);
          setOverlay("report");
        }}
        onUpdateReport={(id) => {
          setUpdateReportId(id);
          setOverlay("report");
        }}
      />
    );
  }

  return (
    <View className="flex-1 bg-safeplus-background">
      <HomeScreen token={token} account={account} onSignOut={onSignOut} />

      {unreadCount > 0 && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: insets.top + 8,
            left: 20,
            right: 20,
            opacity: bannerEntrance,
            transform: [
              {
                translateY: bannerEntrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-18, 0],
                }),
              },
            ],
          }}
        >
          <Pressable
            onPress={() => setOverlay("alerts")}
            accessibilityRole="button"
            accessibilityLabel={`Open ${unreadCount} new DMC alerts`}
            className="flex-row items-center px-4 h-16 overflow-hidden rounded-2xl bg-safeplus-red border border-safeplus-lightRed/35 shadow-xl active:opacity-90"
          >
            <View className="absolute inset-x-0 top-0 h-px bg-white/30" />
            <View className="absolute inset-x-0 bottom-0 h-10 bg-safeplus-navy/15" />

            <View className="items-center justify-center w-10 h-10 mr-3 rounded-xl bg-white/15 border border-white/25">
              <Ionicons name="warning" size={21} color="#FFFFFF" />
            </View>

            <View className="flex-1 mr-2">
              <Text className="text-[13px] font-extrabold uppercase tracking-[1.2px] text-white">
                {liveCount > 0 ? "Emergency alert" : "Alert update"}
              </Text>

              <View className="flex-row items-baseline mt-0.5">
                {liveCount > 0 && (
                  <Text
                    style={tabular}
                    className="mr-2.5 text-[10px] font-bold uppercase tracking-[0.7px] text-white/70"
                  >
                    Live
                  </Text>
                )}
                {liveCount > 0 && (
                  <Text
                    style={tabular}
                    className="mr-3 text-[11.5px] font-extrabold text-white"
                  >
                    {liveCount} {liveCount === 1 ? "warning" : "warnings"}
                  </Text>
                )}

                <Text
                  style={tabular}
                  className="mr-2.5 text-[10px] font-bold uppercase tracking-[0.7px] text-white/70"
                >
                  New
                </Text>
                <Text
                  style={tabular}
                  className="mr-3 text-[11.5px] font-extrabold text-white"
                >
                  {unreadCount} {unreadCount === 1 ? "message" : "messages"}
                </Text>

                <Text className="text-[10px] font-semibold text-white/75">
                  Tap to read
                </Text>
              </View>
            </View>

            <View className="flex-row items-center mr-2 px-2 py-1 rounded-full bg-white/20 border border-white/30">
              <View className="w-1.5 h-1.5 mr-1.5 rounded-full bg-white" />
              <Text className="text-[9px] font-extrabold uppercase tracking-[1px] text-white">
                {liveCount > 0 ? "Live" : "New"}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      )}

      <Pressable
        onPress={() => setOverlay("report")}
        accessibilityRole="button"
        accessibilityLabel="Report a hazard"
        className="absolute right-5 bottom-28 flex-row items-center px-5 h-14 rounded-full bg-safeplus-red border border-safeplus-lightRed/30 shadow-lg active:opacity-85"
      >
        <Ionicons name="warning-outline" size={20} color="#FFFFFF" className="mr-2" />
        <Text className="text-sm font-extrabold text-white">Report a hazard</Text>
      </Pressable>

      <Pressable
        onPress={() => setOverlay("alerts")}
        accessibilityRole="button"
        accessibilityLabel="DMC alerts"
        className="absolute right-20 bottom-8 items-center justify-center w-12 h-12 rounded-full bg-safeplus-navySoft border border-safeplus-navyLine/70 shadow-md active:opacity-85"
      >
        <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
        {unreadCount > 0 && (
          <View className="absolute -top-1 -right-1 items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-safeplus-red border-2 border-safeplus-surface shadow-sm">
            <Text style={tabular} className="text-[10px] font-extrabold text-white">
              {unreadCount}
            </Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPress={() => setOverlay("mine")}
        accessibilityRole="button"
        accessibilityLabel="My reports"
        className="absolute right-5 bottom-8 items-center justify-center w-12 h-12 rounded-full bg-safeplus-navy border border-safeplus-navyLine/70 shadow-md active:opacity-85"
      >
        <Ionicons name="list-outline" size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
