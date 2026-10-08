import { Pressable, Text, View } from "react-native";

import type { Profile } from "../services/dildhara-profileApi";
import { ROLE_LABELS, Section } from "../components/dildhara-ProfileParts";

const COMING_SOON: Record<string, string[]> = {
  CITIZEN: ["Report an incident", "Find nearby relief centres", "Receive disaster warnings"],
  FOOD_DONOR: ["Offer surplus food", "Track your donations"],
  DELIVERY_VOLUNTEER: ["View delivery requests", "Accept and track deliveries"],
  DELIVERY_VOLUNTEER_TEAM: ["View delivery requests", "Assign deliveries to your team"],
  RELIEF_AGENCY: ["Request supplies", "Track incoming aid"],
  ORGANIZATION_TEAM_LEADER: ["View assignments", "Update team availability"],
  INDEPENDENT_TEAM_LEADER: ["View assignments", "Update team availability"],
};

export default function HomeTab({
  profile,
  onOpenProfile,
}: {
  profile: Profile;
  onOpenProfile: () => void;
}) {
  const firstName = profile.user.fullName.split(" ")[0];
  const upcoming = COMING_SOON[profile.user.role] ?? [];

  return (
    <View>
      <Text className="text-3xl font-extrabold text-safeplus-darkGreen">
        Hello, {firstName}
      </Text>
      <Text className="mt-1 mb-6 text-base text-safeplus-muted">
        {ROLE_LABELS[profile.user.role] ?? profile.user.role}
      </Text>

      <Pressable
        onPress={onOpenProfile}
        className="p-5 mb-4 border rounded-3xl border-safeplus-border bg-white active:opacity-80"
      >
        <Text className="text-base font-extrabold text-safeplus-darkGreen">
          Your profile
        </Text>
        <Text className="mt-1 text-sm text-safeplus-muted">
          Keep your contact details up to date so response teams can reach you.
        </Text>
        <Text className="mt-3 text-sm font-extrabold text-safeplus-green">
          View and edit
        </Text>
      </Pressable>

      {upcoming.length > 0 ? (
        <Section title="Coming soon">
          {upcoming.map((item) => (
            <Text key={item} className="py-2 text-base text-safeplus-muted">
              • {item}
            </Text>
          ))}
        </Section>
      ) : null}
    </View>
  );
}