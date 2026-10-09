import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CitizenAlertArea from "./dushani-CitizenAlertArea";
import KaveeshaNearbySheltersScreen from "./kaveesha-NearbySheltersScreen";

import type { LoginAccount } from "../services/dildhara-authApi";

/* ------------------------------------------------------------------ *
 * The citizen's shell.
 *
 * It renders the district's citizen alert area exactly as shipped — we do not
 * touch that screen — and floats one honest addition on top: a "Shelters" button
 * that opens the live nearby-shelter list. This is the additive nav entry the
 * shelter feature promised, and it reaches the feature without changing a
 * teammate's file.
 * ------------------------------------------------------------------ */

interface CitizenShelterHostProps {
  token: string;
  account: LoginAccount;
  onSignOut: () => void;
}

export default function KaveeshaCitizenShelterHost({
  token,
  account,
  onSignOut,
}: CitizenShelterHostProps) {
  const insets = useSafeAreaInsets();
  const [sheltersOpen, setSheltersOpen] = useState(false);

  if (sheltersOpen) {
    return (
      <KaveeshaNearbySheltersScreen
        token={token}
        onBack={() => setSheltersOpen(false)}
      />
    );
  }

  return (
    <View className="flex-1 bg-safeplus-background">
      <CitizenAlertArea
        token={token}
        account={account}
        onSignOut={onSignOut}
      />

      {/* Floating entry to the live shelter list. */}
      <Pressable
        onPress={() => setSheltersOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Find nearby shelters"
        className="absolute flex-row items-center pl-3 pr-5 rounded-full shadow-lg h-14 bg-safeplus-navy active:opacity-90"
        style={{ right: 18, bottom: insets.bottom + 18 }}
      >
        <View className="items-center justify-center w-8 h-8 mr-2 rounded-full bg-white/15">
          <Ionicons name="business" size={18} color="#FFFFFF" />
        </View>
        <Text className="text-[14px] font-extrabold text-white">Shelters</Text>
      </Pressable>
    </View>
  );
}
