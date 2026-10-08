import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Profile } from "../services/dildhara-profileApi";
import { ROLE_LABELS } from "../components/dildhara-ProfileParts";

export type IconName = keyof typeof Ionicons.glyphMap;

export interface HomeProps {
  profile: Profile;
  onOpenProfile: () => void;
  /** Citizen actions */
  onReportHazard?: () => void;
  onOpenMyReports?: () => void;
  onOpenAlerts?: () => void;
  onFindReliefCenters?: () => void;
  unreadCount?: number;
  /** Generic handler for other roles' actions, keyed by action key. */
  onAction?: (key: string) => void;
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeHero({
  profile,
  message,
}: {
  profile: Profile;
  message: string;
}) {
  const firstName = profile.user.fullName.split(" ")[0];
  const roleLabel = ROLE_LABELS[profile.user.role] ?? profile.user.role;

  return (
    <View className="p-6 mb-5 overflow-hidden rounded-[32px] bg-safeplus-darkGreen">
      <View className="absolute w-44 h-44 rounded-full -top-12 -right-10 bg-white/10" />
      <View className="absolute w-28 h-28 rounded-full -bottom-10 right-16 bg-white/10" />

      <Text className="text-sm font-semibold text-white/80">{greeting()},</Text>
      <Text className="mt-0.5 text-3xl font-extrabold text-white">{firstName}</Text>

      <View className="flex-row items-center self-start px-3 py-1.5 mt-4 rounded-full bg-white/15">
        <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
        <Text className="ml-1.5 text-xs font-bold text-white">{roleLabel}</Text>
      </View>

      <Text className="mt-4 text-sm leading-5 text-white/85">{message}</Text>
    </View>
  );
}

export function QuickAction({
  icon,
  label,
  hint,
  badge,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="p-4 mb-3 bg-white border rounded-3xl border-safeplus-border active:opacity-80"
      style={{ width: "48.5%" }}
    >
      <View className="items-center justify-center w-11 h-11 mb-3 rounded-2xl bg-safeplus-background">
        <Ionicons name={icon} size={22} color="#1B7F4B" />
        {badge ? (
          <View className="absolute items-center justify-center h-5 px-1 rounded-full -top-1.5 -right-1.5 min-w-5 bg-safeplus-red">
            <Text className="text-[10px] font-extrabold text-white">{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text className="text-base font-extrabold text-safeplus-darkGreen">{label}</Text>
      <Text className="mt-0.5 text-xs text-safeplus-muted">{hint}</Text>
    </Pressable>
  );
}