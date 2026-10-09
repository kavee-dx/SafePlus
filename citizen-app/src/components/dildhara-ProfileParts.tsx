import type { ReactNode } from "react";
import { Text, View } from "react-native";

export const ROLE_LABELS: Record<string, string> = {
  CITIZEN: "Citizen",
  DELIVERY_VOLUNTEER: "Delivery Volunteer",
  DELIVERY_VOLUNTEER_TEAM: "Delivery Volunteer Team",
  FOOD_DONOR: "Food Donor",
  RELIEF_AGENCY: "Relief Agency",
  ORGANIZATION_ADMIN: "Organization Admin",
  ORGANIZATION_TEAM_LEADER: "Organization Team Leader",
  INDEPENDENT_TEAM_LEADER: "Independent Team Leader",
  DISTRICT_OFFICER: "District Officer",
  COORDINATOR: "Coordinator",
  DMC_OFFICER: "DMC Officer",
};

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function ProfileHeader({
  name,
  role,
  status,
}: {
  name: string;
  role: string;
  status: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const active = status === "ACTIVE";

  return (
    <View className="items-center mb-6">
      <View className="items-center justify-center w-20 h-20 rounded-full bg-safeplus-green">
        <Text className="text-3xl font-extrabold text-white">{initials}</Text>
      </View>

      <Text className="mt-3 text-2xl font-extrabold text-safeplus-darkGreen">
        {name}
      </Text>

      <Text className="mt-1 text-sm text-safeplus-muted">
        {ROLE_LABELS[role] ?? role}
      </Text>

      <View
        className={`mt-3 rounded-full px-3 py-1 ${
          active ? "bg-safeplus-paleGreen" : "bg-safeplus-orange"
        }`}
      >
        <Text
          className={`text-xs font-bold ${
            active ? "text-safeplus-darkGreen" : "text-white"
          }`}
        >
          {active ? "Active" : status.replace(/_/g, " ")}
        </Text>
      </View>
    </View>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View className="p-5 mb-4 bg-white border rounded-3xl border-safeplus-border">
      <Text className="mb-3 text-base font-extrabold text-safeplus-darkGreen">
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <View className="py-2 border-b border-safeplus-border">
      <Text className="text-xs font-bold uppercase text-safeplus-muted">
        {label}
      </Text>
      <Text className="mt-1 text-base text-safeplus-text">
        {formatValue(value)}
      </Text>
    </View>
  );
}