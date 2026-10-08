import { Linking, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Section } from "../components/dildhara-ProfileParts";
import { HomeHero, QuickAction, type HomeProps } from "./amasha-HomeParts";

const SAFETY_TIPS = [
  { icon: "water-outline", text: "Move to higher ground early during flood warnings." },
  { icon: "battery-charging-outline", text: "Keep your phone charged and a power bank ready." },
  { icon: "document-text-outline", text: "Store ID copies and medicines in a waterproof bag." },
] as const;

export default function CitizenHome({
  profile,
  onOpenProfile,
  onReportHazard,
  onOpenMyReports,
  onOpenAlerts,
  onFindReliefCenters,
  unreadCount = 0,
}: HomeProps) {
  return (
    <View>
      <HomeHero
        profile={profile}
        message="Stay informed, report hazards, and receive official DMC alerts."
      />

      {onReportHazard ? (
        <Pressable
          onPress={onReportHazard}
          accessibilityRole="button"
          accessibilityLabel="Report a hazard"
          className="flex-row items-center p-5 mb-3 rounded-3xl bg-safeplus-red active:opacity-90"
        >
          <View className="items-center justify-center w-12 h-12 mr-4 rounded-2xl bg-white/20">
            <Ionicons name="warning" size={26} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-white">Report a hazard</Text>
            <Text className="mt-0.5 text-xs text-white/90">
              Photo, location and details in under a minute.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>
      ) : null}

      {onFindReliefCenters ? (
        <Pressable
          onPress={onFindReliefCenters}
          accessibilityRole="button"
          accessibilityLabel="Find nearby relief centres"
          className="flex-row items-center p-5 mb-5 rounded-3xl bg-safeplus-green active:opacity-90"
        >
          <View className="items-center justify-center w-12 h-12 mr-4 rounded-2xl bg-white/20">
            <Ionicons name="location" size={26} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="text-lg font-extrabold text-white">
                Find nearby relief centres
              </Text>
              {/* <View className="px-2 py-0.5 ml-2 rounded-full bg-white/25">
                <Text className="text-[10px] font-extrabold text-white uppercase">Soon</Text>
              </View> */}
            </View>
            <Text className="mt-0.5 text-xs text-white/90">
              Locate the closest safe shelter.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>
      ) : null}

      <View className="flex-row flex-wrap justify-between">
        {onOpenAlerts ? (
          <QuickAction
            icon="notifications-outline"
            label="DMC alerts"
            hint={unreadCount > 0 ? `${unreadCount} unread` : "No new alerts"}
            badge={unreadCount}
            onPress={onOpenAlerts}
          />
        ) : null}
        {onOpenMyReports ? (
          <QuickAction
            icon="list-outline"
            label="My reports"
            hint="Track and update"
            onPress={onOpenMyReports}
          />
        ) : null}
        <QuickAction
          icon="person-outline"
          label="Your profile"
          hint="Keep contacts current"
          onPress={onOpenProfile}
        />
        <QuickAction
          icon="call-outline"
          label="DMC hotline"
          hint="Call 117 now"
          onPress={() => void Linking.openURL("tel:117")}
        />
      </View>

      <Section title="Safety tips">
        {SAFETY_TIPS.map((tip) => (
          <View key={tip.text} className="flex-row items-center py-2.5">
            <View className="items-center justify-center w-9 h-9 mr-3 rounded-xl bg-safeplus-background">
              <Ionicons name={tip.icon} size={18} color="#1B7F4B" />
            </View>
            <Text className="flex-1 text-sm leading-5 text-safeplus-muted">{tip.text}</Text>
          </View>
        ))}
      </Section>
    </View>
  );
}