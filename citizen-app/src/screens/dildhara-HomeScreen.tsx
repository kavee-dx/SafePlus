import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import {
  AuthApiError,
  type LoginAccount,
} from "../services/dildhara-authApi";
import { fetchMyProfile, type Profile } from "../services/dildhara-profileApi";
import BottomTabBar, { type TabKey } from "../components/dildhara-BottomTabBar";
import AccountScreen from "./dildhara-AccountScreen";
import AlertsTab from "./dildhara-AlertsTab";
import HomeTab from "./dildhara-HomeTab";
import MyResourcesScreen from "./dildhara-MyResourcesScreen";
import ProfileScreen from "./dildhara-ProfileScreen";
import ProvideResourceScreen from "./dildhara-ProvideResourceScreen";

type HomeView = "none" | "resources" | "provide";

interface HomeScreenProps {
  token: string;
  account: LoginAccount;
  onSignOut: () => void;
  onReportHazard?: () => void;
  onOpenMyReports?: () => void;
  onOpenAlerts?: () => void;
  onFindReliefCenters?: () => void;
  onAlertsChanged?: () => void;
  onAction?: (key: string) => void;
  unreadCount?: number;
}

export default function HomeScreen({
  token,
  account,
  onSignOut,
  onReportHazard,
  onOpenMyReports,
  onOpenAlerts,
  onFindReliefCenters,
  onAlertsChanged,
  onAction,
  unreadCount = 0,
}: HomeScreenProps) {
  const [tab, setTab] = useState<TabKey>("home");
  const [view, setView] = useState<HomeView>("none");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchMyProfile(token)
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .catch((error) => {
        if (cancelled) return;

        if (error instanceof AuthApiError && error.status === 401) {
          onSignOut(); // token expired or invalid
          return;
        }

        setErrorMessage(
          error instanceof AuthApiError
            ? error.message
            : "Could not load your profile."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token, onSignOut]);

  const handleAction = (key: string) => {
    if (key === "my-resources") {
      setView("resources");
      return;
    }

    if (key === "provide-resource") {
      setView("provide");
      return;
    }

    onAction?.(key);
  };

  const renderContent = () => {
    if (tab === "account") {
      return <AccountScreen account={account} onSignOut={onSignOut} />;
    }

    if (tab === "alerts") {
      return <AlertsTab token={token} onAlertsChanged={onAlertsChanged} />;
    }

    if (errorMessage) {
      return (
        <View className="p-5 border border-red-200 rounded-3xl bg-red-50">
          <Text className="text-base font-bold text-red-600">{errorMessage}</Text>
        </View>
      );
    }

    if (!profile) {
      return (
        <View className="items-center justify-center py-24">
          <ActivityIndicator size="large" color="#1B7F4B" />
          <Text className="mt-4 text-sm text-safeplus-muted">Loading your dashboard…</Text>
        </View>
      );
    }

    if (tab === "profile") {
      return (
        <ProfileScreen
          token={token}
          profile={profile}
          onProfileUpdated={setProfile}
          onSessionExpired={onSignOut}
        />
      );
    }

    if (view === "resources") {
      return (
        <MyResourcesScreen
          token={token}
          backLabel="← Back to Home"
          onProvideResource={() => setView("provide")}
          onBack={() => setView("none")}
          onSessionExpired={onSignOut}
        />
      );
    }

    if (view === "provide") {
      return (
        <ProvideResourceScreen
          token={token}
          cancelLabel="Back to Home"
          onSuccess={() => setView("resources")}
          onCancel={() => setView("none")}
          onSessionExpired={onSignOut}
        />
      );
    }

    return (
      <HomeTab
        profile={profile}
        onOpenProfile={() => setTab("profile")}
        onReportHazard={onReportHazard}
        onOpenMyReports={onOpenMyReports}
        onOpenAlerts={onOpenAlerts}
        onFindReliefCenters={onFindReliefCenters}
        onAction={handleAction}
        unreadCount={unreadCount}
      />
    );
  };

  return (
    <View
      className="bg-safeplus-background"
      style={[
        { flex: 1 },
        Platform.OS === "web"
          ? ({ height: "100vh" } as unknown as ViewStyle)
          : null,
      ]}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-14 pb-8 w-full max-w-xl self-center"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomTabBar
        active={tab}
        onChange={(next) => {
          setView("none");
          setTab(next);
        }}
      />
    </View>
  );
}