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
import ProfileScreen from "./dildhara-ProfileScreen";

interface HomeScreenProps {
  token: string;
  account: LoginAccount;
  onSignOut: () => void;
}

export default function HomeScreen({ token, account, onSignOut }: HomeScreenProps) {
  const [tab, setTab] = useState<TabKey>("home");
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

  const renderContent = () => {
    if (tab === "account") {
      return <AccountScreen account={account} onSignOut={onSignOut} />;
    }

    if (tab === "alerts") {
      return <AlertsTab />;
    }

    if (errorMessage) {
      return (
        <Text className="text-base font-bold text-red-600">{errorMessage}</Text>
      );
    }

    if (!profile) {
      return <ActivityIndicator size="large" color="#1B7F4B" />;
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

    return <HomeTab profile={profile} onOpenProfile={() => setTab("profile")} />;
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
        >
          {renderContent()}
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomTabBar active={tab} onChange={setTab} />
    </View>
  );
}