import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function AlertsTab() {
  return (
    <View className="items-center px-6 pt-16">
      <View className="items-center justify-center w-20 h-20 rounded-full bg-safeplus-paleGreen">
        <Ionicons name="notifications-outline" size={36} color="#1B7F4B" />
      </View>

      <Text className="mt-5 text-xl font-extrabold text-safeplus-darkGreen">
        No alerts yet
      </Text>

      <Text className="mt-2 text-base leading-6 text-center text-safeplus-muted">
        Disaster warnings and updates from the Disaster Management Centre will
        appear here.
      </Text>
    </View>
  );
}