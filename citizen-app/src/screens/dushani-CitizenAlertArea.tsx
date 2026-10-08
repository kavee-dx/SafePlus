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
import { syncOfflineReports } from "../services/amasha-offlineReports";

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
    void syncOfflineReports(token, account.id).catch(() => undefined);
  }, [token, account.id, pollToken]);

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
      <HomeScreen token={token} account={account} onSignOut={onSignOut} />

      {unreadCount > 0 && (
        <Pressable
          onPress={() => setOverlay("alerts")}
          accessibilityRole="button"
          accessibilityLabel={`Open ${unreadCount} new DMC alerts`}
          className="absolute left-5 right-5 flex-row items-center px-4 h-14 rounded-2xl bg-safeplus-red shadow-lg active:opacity-90"
          style={{ top: insets.top + 8 }}
        >
          <Ionicons name="warning" size={20} color="#FFFFFF" className="mr-3" />
          <View className="flex-1">
            <Text className="text-sm font-extrabold uppercase tracking-wide text-white">
              Emergency alert
            </Text>
            <Text className="text-[11px] text-white/90">
              {unreadCount} new DMC {unreadCount === 1 ? "message" : "messages"} · tap to read
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </Pressable>
      )}

      <Pressable
        onPress={() => setOverlay("report")}
        accessibilityRole="button"
        accessibilityLabel="Report a hazard"
        className="absolute right-5 bottom-24 flex-row items-center px-5 h-14 rounded-full bg-safeplus-red shadow-lg active:opacity-85"
      >
        <Ionicons name="warning-outline" size={20} color="#FFFFFF" className="mr-2" />
        <Text className="text-sm font-extrabold text-white">Report a hazard</Text>
      </Pressable>

      <Pressable
        onPress={() => setOverlay("alerts")}
        accessibilityRole="button"
        accessibilityLabel="DMC alerts"
        className="absolute right-20 bottom-10 items-center justify-center w-12 h-12 rounded-full bg-safeplus-navySoft shadow-lg active:opacity-85"
      >
        <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
        {unreadCount > 0 && (
          <View className="absolute -top-1 -right-1 items-center justify-center min-w-5 h-5 px-1 rounded-full bg-safeplus-red">
            <Text className="text-[10px] font-extrabold text-white">{unreadCount}</Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPress={() => setOverlay("mine")}
        accessibilityRole="button"
        accessibilityLabel="My reports"
        className="absolute right-5 bottom-10 items-center justify-center w-12 h-12 rounded-full bg-safeplus-navy shadow-lg active:opacity-85"
      >
        <Ionicons name="list-outline" size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
