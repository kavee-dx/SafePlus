import { Linking, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/* ------------------------------------------------------------------ *
 * The scene map — web build.
 *
 * react-native-maps is native-only, so the web bundle must not import it.
 * Metro resolves this file for web (kaveesha-MissionMap.web.tsx) and the
 * native component elsewhere, keeping the call site identical in both. Web
 * shows a clean location card that opens the route in Google Maps on tap.
 * ------------------------------------------------------------------ */

interface MissionMapProps {
  destination: { lat: number; lng: number };
  title?: string;
  description?: string;
  onPress: () => void;
}

export default function MissionMap({ destination, title, onPress }: MissionMapProps) {
  const openInMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`;
    void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <Pressable
      onPress={() => onPress()}
      onLongPress={openInMaps}
      accessibilityRole="button"
      className="mb-3 active:opacity-95"
      style={{ borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "#E1EAFB", backgroundColor: "#E7F0FF" }}
    >
      <View className="flex-row items-center gap-3" style={{ padding: 16 }}>
        <View
          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#DDEAFE", alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="location" size={22} color="#1570EF" />
        </View>
        <View className="flex-1">
          <Text style={{ color: "#101828", fontWeight: "800", fontSize: 14 }} numberOfLines={1}>
            {title ?? "Incident location"}
          </Text>
          <Text style={{ color: "#475467", fontWeight: "600", fontSize: 11.5, marginTop: 2 }}>
            {destination.lat.toFixed(5)}, {destination.lng.toFixed(5)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5" style={{ backgroundColor: "#0B1B34", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
          <Ionicons name="navigate-outline" size={13} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>Open route</Text>
        </View>
      </View>
    </Pressable>
  );
}
