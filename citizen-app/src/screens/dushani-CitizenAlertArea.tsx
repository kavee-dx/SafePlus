import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";

import { saveAlertTarget } from "../services/dushani-alertApi";
import type { LoginAccount } from "../services/dildhara-authApi";
import HomeScreen from "./dildhara-HomeScreen";
import MyReportsScreen from "./dushani-MyReportsScreen";
import ReportHazardScreen from "./dushani-ReportHazardScreen";

type Overlay = "none" | "report" | "mine";

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
  const [overlay, setOverlay] = useState<Overlay>("none");

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

  if (overlay === "report") {
    return (
      <ReportHazardScreen
        token={token}
        onBack={() => setOverlay("none")}
        onViewReports={() => setOverlay("mine")}
      />
    );
  }

  if (overlay === "mine") {
    return (
      <MyReportsScreen
        token={token}
        onBack={() => setOverlay("none")}
        onNewReport={() => setOverlay("report")}
      />
    );
  }

  return (
    <View className="flex-1 bg-safeplus-background">
      <HomeScreen token={token} account={account} onSignOut={onSignOut} />

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
