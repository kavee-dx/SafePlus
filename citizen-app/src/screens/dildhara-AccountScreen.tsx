import { Pressable, Text, View } from "react-native";

import type { LoginAccount } from "../services/dildhara-authApi";
import { Field, Section } from "../components/dildhara-ProfileParts";

const INTERFACE_NAMES: Record<string, string> = {
  MOBILE_APP: "SafePlus mobile app",
  DMC_PORTAL: "SafePlus DMC portal",
};

export default function AccountScreen({
  account,
  onSignOut,
}: {
  account: LoginAccount;
  onSignOut: () => void;
}) {
  return (
    <View>
      <Section title="Sign-in details">
        <Field label="Email" value={account.email} />
        <Field label="Username" value={account.username} />
        <Field label="Account status" value={account.status} />
      </Section>

      <Section title="Access">
        <Field
          label="You can sign in to"
          value={account.interfaces
            .map((name) => INTERFACE_NAMES[name] ?? name)
            .join(", ")}
        />
      </Section>

      <Pressable
        onPress={onSignOut}
        className="items-center justify-center mt-2 border h-14 rounded-2xl border-safeplus-border bg-white active:opacity-80"
      >
        <Text className="text-base font-extrabold text-red-600">Sign out</Text>
      </Pressable>
    </View>
  );
}