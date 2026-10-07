import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import TeamLeaderForm, {
  type TeamLeaderVariant,
} from "../components/dushani-TeamLeaderForm";
import { FormScreenShell } from "../components/dushani-RegistrationUI";

interface TeamLeaderRegistrationScreenProps {
  onBack: () => void;
  onSuccess: (registrationType: string) => void;
}

const TABS: {
  id: TeamLeaderVariant;
  label: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: "organization",
    label: "Organization team",
    caption:
      "You lead a rescue team that belongs to a registered organization. Your own organization admin approves the team.",
    icon: "business-outline",
  },
  {
    id: "independent",
    label: "Community team",
    caption:
      "You lead a neighbourhood or community rescue team with no parent organization. A Super Admin approves the team.",
    icon: "people-outline",
  },
];

export default function TeamLeaderRegistrationScreen({
  onBack,
  onSuccess,
}: TeamLeaderRegistrationScreenProps) {
  const [activeTab, setActiveTab] = useState<TeamLeaderVariant>("organization");

  const activeTabConfig = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  return (
    <FormScreenShell
      title="Rescue team registration"
      subtitle="Choose the kind of team you lead"
      badge="Step 1 of 1"
      onBack={onBack}
      headerExtra={
        <View>
          <View className="flex-row p-1 bg-safeplus-navySoft rounded-xl">
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab;

              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  className={`flex-row items-center justify-center flex-1 h-12 rounded-lg ${
                    isActive ? "bg-safeplus-blue" : "bg-transparent"
                  }`}
                >
                  <Ionicons
                    name={tab.icon}
                    size={17}
                    color={isActive ? "#FFFFFF" : "#CBD5E1"}
                    className="mr-2"
                  />
                  <Text
                    className={`text-sm ${
                      isActive
                        ? "font-extrabold text-white"
                        : "font-bold text-safeplus-navyText"
                    }`}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="mt-3 text-xs leading-5 text-safeplus-navyText">
            {activeTabConfig.caption}
          </Text>
        </View>
      }
    >
      <TeamLeaderForm
        key={activeTab}
        variant={activeTab}
        onSuccess={onSuccess}
      />
    </FormScreenShell>
  );
}
