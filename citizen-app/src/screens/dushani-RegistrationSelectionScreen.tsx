import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Notice } from "../components/dushani-RegistrationUI";

interface RegistrationSelectionScreenProps {
  onBack: () => void;
  onSelectType: (type: string) => void;
}

type Tone = "green" | "blue" | "amber" | "red";

const TONES: Record<Tone, { tile: string; icon: string }> = {
  green: { tile: "bg-safeplus-lightGreen", icon: "#16A34A" },
  blue: { tile: "bg-safeplus-blueSoft", icon: "#1570EF" },
  amber: { tile: "bg-safeplus-amberSoft", icon: "#B54708" },
  red: { tile: "bg-safeplus-lightRed", icon: "#D92D20" },
};

const GROUPS: {
  label: string;
  options: {
    id: string;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    tone: Tone;
  }[];
}[] = [
  {
    label: "Stay informed",
    options: [
      {
        id: "citizen",
        title: "Citizen",
        description: "Receive early warnings and find shelters near you",
        icon: "person-outline",
        tone: "green",
      },
    ],
  },
  {
    label: "Help others",
    options: [
      {
        id: "delivery-volunteer",
        title: "Delivery volunteer or delivery team",
        description: "Move relief items on your own or with your team",
        icon: "car-outline",
        tone: "amber",
      },
      {
        id: "team-leader",
        title: "Rescue team leader",
        description:
          "Lead an organization or community rescue team on the app and the portal",
        icon: "shield-checkmark-outline",
        tone: "red",
      },
      {
        id: "food-donor",
        title: "Individual food donor",
        description: "Offer meals and rations during an emergency",
        icon: "restaurant-outline",
        tone: "blue",
      },
    ],
  },
  {
    label: "Agencies and officials",
    options: [
      {
        id: "relief-agency",
        title: "Resource donor organization",
        description: "Government departments, NGOs, military units and other organizations that donate resources",
        icon: "business-outline",
        tone: "blue",
      },
    ],
  },
];

export default function RegistrationSelectionScreen({
  onBack,
  onSelectType,
}: RegistrationSelectionScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-safeplus-canvas">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="bg-safeplus-navy px-5 pb-24 sm:px-8"
          style={{ paddingTop: insets.top + 24 }}
        >
          <View className="flex-row items-center">
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back to login"
              className="items-center justify-center w-11 h-11 mr-4 rounded-xl bg-safeplus-navySoft active:opacity-80"
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-2xl font-extrabold text-white">
                Create your account
              </Text>
              <Text className="mt-1 text-sm text-safeplus-navyText">
                Choose the option that best describes you
              </Text>
            </View>
          </View>
        </View>

        <View className="px-5 -mt-14 sm:px-8">
          <View className="w-full max-w-2xl mx-auto">
            {GROUPS.map((group) => (
              <View key={group.label} className="mb-6">
                <Text className="mb-3 ml-1 text-[11px] font-extrabold tracking-widest text-safeplus-slate uppercase">
                  {group.label}
                </Text>
                <View className="space-y-3">
                  {group.options.map((option) => {
                    const tone = TONES[option.tone];

                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => onSelectType(option.id)}
                        accessibilityRole="button"
                        className="flex-row items-center p-5 bg-safeplus-surface rounded-2xl border border-safeplus-hairline shadow-sm active:opacity-85"
                      >
                        <View
                          className={`items-center justify-center w-12 h-12 mr-4 rounded-xl ${tone.tile}`}
                        >
                          <Ionicons
                            name={option.icon}
                            size={22}
                            color={tone.icon}
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-base font-extrabold text-safeplus-navy">
                            {option.title}
                          </Text>
                          <Text className="mt-1 text-[13px] leading-5 text-safeplus-slate">
                            {option.description}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color="#94A3B8"
                          className="ml-2"
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            <Notice
              tone="info"
              title="You can add details later"
              body="Resources, skills and availability are completed from your dashboard after you sign in."
            />

            <View className="mt-4">
              <Notice
                tone="info"
                title="Coordinators and DMC officers"
                body="Register on the DMC portal instead. This app is for citizens, delivery volunteers, donors and relief agencies."
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
