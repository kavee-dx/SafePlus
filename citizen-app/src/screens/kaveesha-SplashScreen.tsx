import { useEffect } from "react";
import { Text, View } from "react-native";

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({
  onFinish,
}: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2400);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View className="flex-1 bg-safeplus-darkGreen">
      {/* Decorative background shapes */}
      <View className="absolute w-64 h-64 rounded-full -right-20 -top-20 bg-safeplus-green opacity-20" />

      <View className="absolute rounded-full -bottom-24 -left-20 h-72 w-72 bg-safeplus-yellow opacity-10" />

      <View className="items-center justify-center flex-1 px-6">
        {/* Logo */}
        <View className="h-28 w-28 items-center justify-center rounded-[32px] bg-safeplus-white shadow-2xl">
          <View className="h-20 w-20 items-center justify-center rounded-[25px] bg-safeplus-green">
            <Text className="text-4xl font-extrabold text-white">
              S+
            </Text>
          </View>
        </View>

        {/* Brand */}
        <Text className="text-4xl font-extrabold tracking-tight text-white mt-7">
          SafePlus
        </Text>

        <Text className="mt-2 text-base font-medium text-center text-green-100">
          Smart Disaster Early-Warning
        </Text>

        <Text className="mt-1 text-base font-medium text-center text-green-100">
          & Emergency Coordination
        </Text>

        {/* Accent */}
        <View className="flex-row items-center gap-2 mt-8">
          <View className="w-2 h-2 rounded-full bg-safeplus-yellow" />
          <View className="w-8 h-2 rounded-full bg-safeplus-orange" />
          <View className="w-2 h-2 rounded-full bg-safeplus-yellow" />
        </View>
      </View>

      {/* Footer */}
      <View className="items-center pb-10">
        <Text className="text-xs font-medium text-green-200">
          Protect • Connect • Respond
        </Text>
      </View>
    </View>
  );
}