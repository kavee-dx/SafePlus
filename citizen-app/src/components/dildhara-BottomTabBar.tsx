import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type TabKey = "home" | "alerts" | "profile" | "account";
type IconName = React.ComponentProps<typeof Ionicons>["name"];

const TABS: {
  key: TabKey;
  label: string;
  icon: IconName;
  activeIcon: IconName;
}[] = [
  { key: "home", label: "Home", icon: "home-outline", activeIcon: "home" },
  {
    key: "alerts",
    label: "Alerts",
    icon: "notifications-outline",
    activeIcon: "notifications",
  },
  { key: "profile", label: "Profile", icon: "person-outline", activeIcon: "person" },
  {
    key: "account",
    label: "Account",
    icon: "shield-checkmark-outline",
    activeIcon: "shield-checkmark",
  },
];

const ACTIVE_COLOR = "#1B7F4B";
const INACTIVE_COLOR = "#66736B";

export default function BottomTabBar({
  active,
  onChange,
  unreadCount = 0,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  unreadCount?: number;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row bg-white border-t border-safeplus-border"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      {TABS.map((tab) => {
        const selected = tab.key === active;
        const showBadge = tab.key === "alerts" && unreadCount > 0;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={
              showBadge ? `${tab.label}, ${unreadCount} unread` : tab.label
            }
            className="items-center flex-1 pt-3 pb-1"
          >
            <View>
              <Ionicons
                name={selected ? tab.activeIcon : tab.icon}
                size={24}
                color={selected ? ACTIVE_COLOR : INACTIVE_COLOR}
              />
              {showBadge ? (
                <View className="absolute items-center justify-center h-4 px-1 rounded-full -top-1 -right-2.5 min-w-4 bg-safeplus-red">
                  <Text className="text-[10px] font-extrabold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              className={`mt-1 text-xs font-bold ${
                selected ? "text-safeplus-green" : "text-safeplus-muted"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}