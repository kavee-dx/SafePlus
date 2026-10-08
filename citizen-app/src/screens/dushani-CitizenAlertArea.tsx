import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchAlertInbox,
  saveAlertTarget,
} from "../services/dushani-alertApi";
import type { LoginAccount } from "../services/dildhara-authApi";
import HomeScreen from "./dildhara-HomeScreen";
import AlertInboxScreen from "./dushani-AlertInboxScreen";
import MyReportsScreen from "./amasha-MyReportsScreen";
import ReportHazardScreen from "./amasha-ReportHazardScreen";
import { startOfflineSync } from "../services/amasha-offlineSync";

type Overlay = "none" | "report" | "mine" | "alerts";

/** An emergency text is worth waiting for, but not worth a websocket. */
const INBOX_POLL_MS = 20_000;

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
  const [pollToken, setPollToken] = useState(0);

  // Without a push token this phone is invisible to a district broadcast, so
  // the app registers it quietly on entry.
  useEffect(() => {
    if (!Device.isDevice) {
      return;
    }

    let cancelled = false;

    Notifications.getExpoPushTokenAsync()
      .then((registration) => {
        if (!cancelled) {
          void saveAlertTarget(token, { deviceToken: registration.data }).catch(
            () => undefined
          );
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    fetchAlertInbox(token)
      .then((inbox) => setUnreadCount(inbox.unreadCount))
      .catch(() => undefined);
  }, [token, pollToken]);

  useEffect(() => {
    const timer = setInterval(
      () => setPollToken((current) => current + 1),
      INBOX_POLL_MS
    );

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return startOfflineSync(token, account.id);
  }, [token, account.id]);

  // TODO: open the relief centres screen once it is built
  // (add "relief" to Overlay and call setOverlay("relief") here).
  const handleFindReliefCenters = () => {};

  if (overlay === "alerts") {
    return (
      <AlertInboxScreen
        token={token}
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
      <HomeScreen
        token={token}
        account={account}
        onSignOut={onSignOut}
        unreadCount={unreadCount}
        onReportHazard={() => {
          setUpdateReportId(null);
          setOverlay("report");
        }}
        onOpenMyReports={() => setOverlay("mine")}
        onOpenAlerts={() => setOverlay("alerts")}
        onFindReliefCenters={handleFindReliefCenters}
        onAlertsChanged={() => setPollToken((current) => current + 1)}
      />

      {unreadCount > 0 && (
        <Pressable
          onPress={() => setOverlay("alerts")}
          accessibilityRole="button"
          accessibilityLabel={`Open ${unreadCount} new DMC alerts`}
          className="absolute flex-row items-center h-14 px-4 shadow-lg left-5 right-5 rounded-2xl bg-safeplus-red active:opacity-90"
          style={{ top: insets.top + 8 }}
        >
          <Ionicons
            name="warning"
            size={20}
            color="#FFFFFF"
            style={{ marginRight: 12 }}
          />
          <View className="flex-1">
            <Text className="text-sm font-extrabold tracking-wide text-white uppercase">
              Emergency alert
            </Text>
            <Text className="text-[11px] text-white/90">
              {unreadCount} new DMC {unreadCount === 1 ? "message" : "messages"} · tap to read
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
}