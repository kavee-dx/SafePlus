import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface LoginScreenProps {
  onShowRegistration?: () => void;
}

export default function LoginScreen({
  onShowRegistration,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View className="flex-1 bg-safeplus-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 md:flex-row">
          {/* =====================================================
              LEFT / BRANDING SECTION
              Visible as a beautiful website panel on desktop
              ===================================================== */}

          <View className="justify-between flex-1 hidden px-10 py-12 overflow-hidden bg-safeplus-darkGreen md:flex lg:px-16 lg:py-16">
            {/* Decorative circles */}
            <View className="absolute rounded-full -right-24 -top-24 h-80 w-80 bg-safeplus-green opacity-20" />

            <View className="absolute rounded-full -bottom-32 -left-20 h-96 w-96 bg-safeplus-yellow opacity-10" />

            <View className="absolute w-32 h-32 rounded-full right-20 top-1/2 bg-safeplus-orange opacity-10" />

            {/* Logo */}
            <View className="z-10">
              <View className="items-center justify-center bg-white h-14 w-14 rounded-2xl">
                <Text className="text-2xl font-extrabold text-safeplus-green">
                  S+
                </Text>
              </View>

              <Text className="mt-4 text-2xl font-extrabold text-white">
                SafePlus
              </Text>
            </View>

            {/* Main message */}
            <View className="z-10 max-w-xl">
              <View className="flex-row items-center gap-2 mb-5">
                <View className="w-2 h-2 rounded-full bg-safeplus-yellow" />

                <Text className="text-sm font-bold tracking-widest uppercase text-safeplus-yellow">
                  Smart Emergency Response
                </Text>
              </View>

              <Text className="text-5xl font-extrabold leading-tight text-white lg:text-6xl">
                Stay safe.
                {"\n"}
                Stay informed.
              </Text>

              <Text className="max-w-lg mt-6 text-lg leading-8 text-green-100">
                Receive early warnings, discover safe locations, and stay
                connected with emergency response teams when it matters most.
              </Text>

              {/* Feature highlights */}
              <View className="gap-5 mt-10">
                <FeatureItem
                  icon="✓"
                  title="Early disaster warnings"
                  description="Get important alerts when threats are detected."
                />

                <FeatureItem
                  icon="⌖"
                  title="Emergency coordination"
                  description="Connect citizens with response teams."
                />

                <FeatureItem
                  icon="♥"
                  title="Community safety"
                  description="Work together to keep communities protected."
                />
              </View>
            </View>

            {/* Footer */}
            <Text className="z-10 text-sm text-green-200">
              © SafePlus • Smart Disaster Response
            </Text>
          </View>

          {/* =====================================================
              RIGHT / LOGIN SECTION
              ===================================================== */}

          <View className="items-center justify-center flex-1 px-5 py-10 sm:px-8 md:px-10 lg:px-16">
            <View className="w-full max-w-xl">
              {/* Mobile logo */}
              <View className="items-center mb-8 md:hidden">
                <View className="items-center justify-center w-16 h-16 shadow-lg rounded-2xl bg-safeplus-green">
                  <Text className="text-2xl font-extrabold text-white">S+</Text>
                </View>

                <Text className="mt-3 text-2xl font-extrabold text-safeplus-darkGreen">
                  SafePlus
                </Text>
              </View>

              {/* Login card */}
              <View className="rounded-[28px] border border-safeplus-border bg-white p-6 shadow-xl sm:p-8 md:p-10">
                {/* Heading */}
                <View className="mb-8">
                  <View className="mb-4 h-1.5 w-12 rounded-full bg-safeplus-orange" />

                  <Text className="text-3xl font-extrabold text-safeplus-darkGreen">
                    Welcome back
                  </Text>

                  <Text className="mt-2 text-base leading-6 text-safeplus-muted">
                    Sign in to your SafePlus account to continue.
                  </Text>
                </View>

                {/* Email */}
                <View className="mb-5">
                  <Text className="mb-2 text-sm font-bold text-safeplus-text">
                    Email address
                  </Text>

                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#9AA79F"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="px-4 text-base border h-14 rounded-2xl border-safeplus-border bg-safeplus-paleGreen text-safeplus-text"
                  />
                </View>

                {/* Password */}
                <View className="mb-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-bold text-safeplus-text">
                      Password
                    </Text>

                    <Pressable>
                      <Text className="text-sm font-bold text-safeplus-green">
                        Forgot password?
                      </Text>
                    </Pressable>
                  </View>

                  <View className="flex-row items-center border rounded-2xl border-safeplus-border bg-safeplus-paleGreen">
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter your password"
                      placeholderTextColor="#9AA79F"
                      secureTextEntry={!showPassword}
                      className="flex-1 px-4 text-base h-14 text-safeplus-text"
                    />

                    <Pressable
                      onPress={() => setShowPassword((value) => !value)}
                      className="px-4"
                      accessibilityLabel={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={22}
                        color="#66736B"
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Login button */}
                <Pressable className="items-center justify-center mt-6 shadow-lg h-14 rounded-2xl bg-safeplus-green active:opacity-80">
                  <Text className="text-base font-extrabold text-white">
                    Sign In
                  </Text>
                </Pressable>

                {/* Divider */}
                <View className="flex-row items-center my-7">
                  <View className="flex-1 h-px bg-safeplus-border" />

                  <Text className="mx-4 text-xs font-medium text-safeplus-muted">
                    OR
                  </Text>

                  <View className="flex-1 h-px bg-safeplus-border" />
                </View>

                {/* Create account */}
                <View className="flex-row items-center justify-center">
                  <Text className="text-sm text-safeplus-muted">
                    Don't have an account?
                  </Text>

                  {onShowRegistration && (
                    <Pressable onPress={onShowRegistration} className="ml-1">
                      <Text className="text-sm font-extrabold text-safeplus-darkGreen">
                        Create account
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Security message */}
              <View className="flex-row items-center justify-center mt-6">
                <View className="w-2 h-2 mr-2 rounded-full bg-safeplus-green" />

                <Text className="text-xs text-safeplus-muted">
                  Your information is securely protected.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ============================================================
   Desktop feature item
   ============================================================ */

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View className="flex-row items-start">
      <View className="items-center justify-center mr-4 h-11 w-11 rounded-xl bg-white/10">
        <Text className="text-lg font-bold text-safeplus-yellow">{icon}</Text>
      </View>

      <View className="flex-1">
        <Text className="text-base font-bold text-white">{title}</Text>

        <Text className="mt-1 text-sm leading-5 text-green-200">
          {description}
        </Text>
      </View>
    </View>
  );
}
