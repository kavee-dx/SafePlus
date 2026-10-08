import { View } from "react-native";

import {
  HomeHero,
  QuickAction,
  type HomeProps,
  type IconName,
} from "./amasha-HomeParts";

interface RoleAction {
  key: string;
  icon: IconName;
  label: string;
  hint: string;
}

interface RoleConfig {
  message: string;
  actions: RoleAction[];
}

const ROLE_HOME: Record<string, RoleConfig> = {
  FOOD_DONOR: {
    message: "Share surplus food with people who need it.",
    actions: [
      { key: "offer-food", icon: "restaurant-outline", label: "Offer food", hint: "List surplus items" },
      { key: "my-donations", icon: "gift-outline", label: "My donations", hint: "Track your donations" },
    ],
  },
  DELIVERY_VOLUNTEER: {
    message: "Help deliver food and supplies where they are needed.",
    actions: [
      { key: "requests", icon: "bicycle-outline", label: "Requests", hint: "View delivery requests" },
      { key: "my-deliveries", icon: "navigate-outline", label: "My deliveries", hint: "Accept and track" },
    ],
  },
  DELIVERY_VOLUNTEER_TEAM: {
    message: "Coordinate your team's deliveries.",
    actions: [
      { key: "requests", icon: "bicycle-outline", label: "Requests", hint: "View delivery requests" },
      { key: "assign", icon: "people-outline", label: "Assign", hint: "Assign to your team" },
    ],
  },
  RELIEF_AGENCY: {
    message: "Offer resources and support relief operations.",
    actions: [
      { key: "my-resources", icon: "cube-outline", label: "My resources", hint: "View what you offered" },
      { key: "provide-resource", icon: "add-circle-outline", label: "Provide resource", hint: "Add a new resource" },
    ],
  },
  ORGANIZATION_TEAM_LEADER: {
    message: "Manage your team's assignments and availability.",
    actions: [
      { key: "assignments", icon: "clipboard-outline", label: "Assignments", hint: "View tasks" },
      { key: "availability", icon: "calendar-outline", label: "Availability", hint: "Update team status" },
    ],
  },
  INDEPENDENT_TEAM_LEADER: {
    message: "Manage your team's assignments and availability.",
    actions: [
      { key: "assignments", icon: "clipboard-outline", label: "Assignments", hint: "View tasks" },
      { key: "availability", icon: "calendar-outline", label: "Availability", hint: "Update team status" },
    ],
  },
};

const DEFAULT_CONFIG: RoleConfig = { message: "Welcome back to SafePlus.", actions: [] };

export default function RoleHome({ profile, onOpenProfile, onAction }: HomeProps) {
  const config = ROLE_HOME[profile.user.role] ?? DEFAULT_CONFIG;

  return (
    <View>
      <HomeHero profile={profile} message={config.message} />

      <View className="flex-row flex-wrap justify-between">
        {config.actions.map((action) => (
          <QuickAction
            key={action.key}
            icon={action.icon}
            label={action.label}
            hint={action.hint}
            onPress={() => onAction?.(action.key)}
          />
        ))}
        <QuickAction
          icon="person-outline"
          label="Your profile"
          hint="Keep contacts current"
          onPress={onOpenProfile}
        />
      </View>
    </View>
  );
}