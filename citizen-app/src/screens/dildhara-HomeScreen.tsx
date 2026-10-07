import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import {
  AuthApiError,
  type LoginAccount,
} from "../services/dildhara-authApi";
import { fetchMyProfile, type Profile } from "../services/dildhara-profileApi";
import AccountScreen from "./dildhara-AccountScreen";
import BasicProfile from "./dildhara-BasicProfile";
import OfficerProfile from "./dildhara-OfficerProfile";
import OrganizationProfile from "./dildhara-OrganizationProfile";
import TeamProfile from "./dildhara-TeamProfile";
import VolunteerProfile from "./dildhara-VolunteerProfile";

interface HomeScreenProps {
  token: string;
  account: LoginAccount;
  onSignOut: () => void;
}

function ProfileForRole({ profile }: { profile: Profile }) {
  switch (profile.user.role) {
    case "DELIVERY_VOLUNTEER":
      return <VolunteerProfile profile={profile} />;

    case "DELIVERY_VOLUNTEER_TEAM":
    case "ORGANIZATION_TEAM_LEADER":
    case "INDEPENDENT_TEAM_LEADER":
      return <TeamProfile profile={profile} />;

    case "RELIEF_AGENCY":
    case "ORGANIZATION_ADMIN":
      return <OrganizationProfile profile={profile} />;

    case "DISTRICT_OFFICER":
    case "DMC_OFFICER":
      return <OfficerProfile profile={profile} />;

    default: // CITIZEN, FOOD_DONOR, COORDINATOR
      return <BasicProfile profile={profile} />;
  }
}

export default function HomeScreen({ token, account, onSignOut }: HomeScreenProps) {
  const [tab, setTab] = useState<"profile" | "account">("profile");
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

  return (
    <View className="flex-1 bg-safeplus-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-14 pb-8 w-full max-w-xl self-center"
      >
        {tab === "account" ? (
          <AccountScreen account={account} onSignOut={onSignOut} />
        ) : errorMessage ? (
          <Text className="text-base font-bold text-red-600">{errorMessage}</Text>
        ) : profile ? (
          <ProfileForRole profile={profile} />
        ) : (
          <ActivityIndicator size="large" color="#1B7F4B" />
        )}
      </ScrollView>

      <View className="flex-row bg-white border-t border-safeplus-border">
        {(["profile", "account"] as const).map((name) => (
          <Pressable
            key={name}
            onPress={() => setTab(name)}
            className="items-center flex-1 py-4"
          >
            <Text
              className={`text-sm font-extrabold ${
                tab === name ? "text-safeplus-green" : "text-safeplus-muted"
              }`}
            >
              {name === "profile" ? "Profile" : "Account"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}