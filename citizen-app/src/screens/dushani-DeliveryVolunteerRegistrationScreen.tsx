import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import DeliveryVolunteerForm from "../components/dushani-DeliveryVolunteerForm";
import DeliveryTeamForm from "../components/dushani-DeliveryTeamForm";
import { FormScreenShell } from "../components/dushani-RegistrationUI";

interface DeliveryVolunteerRegistrationScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

type DeliveryTab = "individual" | "team";

const TABS: {
  id: DeliveryTab;
  label: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: "individual",
    label: "Delivery volunteer",
    caption:
      "Register yourself to move relief items. Tell us your operating area and whether you have a vehicle.",
    icon: "person-outline",
  },
  {
    id: "team",
    label: "Delivery volunteer team",
    caption:
      "Register a team with a leader, member count, operating district and vehicles.",
    icon: "people-outline",
  },
];

export default function DeliveryVolunteerRegistrationScreen({
  onBack,
  onSuccess,
}: DeliveryVolunteerRegistrationScreenProps) {
  const [activeTab, setActiveTab] = useState<DeliveryTab>("individual");

  const activeTabConfig = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  return (
    <FormScreenShell
      title="Delivery volunteer registration"
      subtitle="Choose how you want to register"
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
      {activeTab === "individual" ? (
        <DeliveryVolunteerForm onSuccess={onSuccess} />
      ) : (
        <DeliveryTeamForm onSuccess={onSuccess} />
      )}
    </FormScreenShell>
  );
}
