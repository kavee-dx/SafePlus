import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LeaderNotification } from "../services/kaveesha-leaderApi";

/* ------------------------------------------------------------------ *
 * The leader's message tray (UC-03, mobile).
 *
 * A tasking that arrives while the phone is out of signal must not be lost with
 * the push banner that faded. This is the standing record: every mission the
 * district handed this team, and every stand-down, kept in order so a leader
 * climbing into the boat can reopen the one that matters and tap it away once
 * read. It lives as a footer tab, so the board never disappears under it.
 *
 * One tap does two things the field asked for: it marks the message read (its
 * colour fades to neutral) and opens the mission it points at. Read/unread colour
 * mirrors the officer's portal tray so the two consoles speak the same language.
 * ------------------------------------------------------------------ */

interface NotificationsScreenProps {
  items: LeaderNotification[];
  loading: boolean;
  error: string | null;
  /** Mark the message read and open the incident it refers to. */
  onOpen: (item: LeaderNotification) => void;
  onRetry: () => void;
}

interface Presentation {
  glyph: keyof typeof Ionicons.glyphMap;
  tone: string;
  wash: string;
}

/** Which icon and colour carry each kind of message, so a glance separates a new
 *  tasking from a stand-down without reading a word. */
function present(type: string): Presentation {
  switch (type) {
    case "TEAM_TASKED":
      return { glyph: "radio-outline", tone: "#D92D20", wash: "#FEF3F2" };
    case "MISSION_STOOD_DOWN":
      return { glyph: "stop-circle-outline", tone: "#667085", wash: "#F2F4F7" };
    case "WARNING_CREATED":
      return { glyph: "alert-circle-outline", tone: "#F79009", wash: "#FFFAEB" };
    default:
      return { glyph: "notifications-outline", tone: "#1570EF", wash: "#EFF4FF" };
  }
}

function timeAgo(value: string): string {
  const at = new Date(value).getTime();

  if (!Number.isFinite(at)) return "";

  const mins = Math.max(0, Math.round((Date.now() - at) / 60000));

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;

  const hours = Math.round(mins / 60);

  if (hours < 24) return `${hours} hr ago`;

  return new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function KaveeshaLeaderNotificationsScreen({
  items,
  loading,
  error,
  onOpen,
  onRetry,
}: NotificationsScreenProps) {
  const insets = useSafeAreaInsets();
  const unread = items.filter((item) => !item.isRead).length;

  if (error) {
    return (
      <View
        className="flex-1 items-center justify-center px-8 bg-safeplus-background"
        style={{ paddingTop: insets.top }}
      >
        <Ionicons name="cloud-offline-outline" size={30} color="#98A2B3" />
        <Text className="text-[14px] text-safeplus-muted text-center mt-3 leading-5">
          {error}
        </Text>
        <Pressable
          onPress={onRetry}
          className="mt-4 px-5 h-11 rounded-2xl bg-safeplus-navy items-center justify-center active:opacity-90"
        >
          <Text className="text-white font-extrabold">Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (loading && items.length === 0) {
    return (
      <View
        className="flex-1 items-center justify-center bg-safeplus-background"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator size="large" color="#1570EF" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-safeplus-background"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: 120,
        paddingHorizontal: 16,
      }}
    >
      {/* Hero band: the one number a busy leader wants first — what is waiting. */}
      <View
        className="rounded-[22px] p-5 mb-4"
        style={{
          backgroundColor: "#0B1F33",
          shadowColor: "#0B1B34",
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 5,
        }}
      >
        <Text className="text-[11px] font-extrabold uppercase tracking-[2px] text-white/50">
          Message tray
        </Text>
        <Text className="text-[22px] font-extrabold text-white mt-1.5">
          {unread > 0 ? `${unread} unread` : "All caught up"}
        </Text>
        <Text className="text-[12.5px] text-white/70 mt-1 leading-[18px]">
          {unread > 0
            ? "From the district. Tap a message to open its mission."
            : items.length > 0
              ? "Nothing waiting. Every message has been opened."
              : "Taskings and updates for your team land here."}
        </Text>
      </View>

      {items.length === 0 ? (
        <View className="items-center rounded-3xl bg-safeplus-white border border-safeplus-border px-6 py-10">
          <Ionicons name="notifications-off-outline" size={30} color="#98A2B3" />
          <Text className="text-[14px] font-semibold text-safeplus-muted text-center mt-3 leading-5">
            No messages yet. When the district tasks your team, it will show up
            here.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {items.map((item) => (
            <NotificationRow key={item.id} item={item} onOpen={() => onOpen(item)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function NotificationRow({
  item,
  onOpen,
}: {
  item: LeaderNotification;
  onOpen: () => void;
}) {
  const look = present(item.type);
  const read = item.isRead;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      className="relative flex-row items-stretch overflow-hidden rounded-[20px] bg-safeplus-white active:opacity-90"
      style={{
        borderWidth: 1,
        borderColor: read ? "#EAEEF3" : "#DCE4F7",
        paddingLeft: 15,
        paddingRight: 14,
        paddingVertical: 14,
        gap: 12,
        shadowColor: "#0B1B34",
        shadowOpacity: read ? 0.04 : 0.07,
        shadowRadius: read ? 8 : 12,
        shadowOffset: { width: 0, height: read ? 3 : 5 },
        elevation: read ? 1 : 3,
      }}
    >
      {/* Type-coloured left rail: bright while unread, neutral once read. */}
      <View
        className="absolute left-0 top-0 bottom-0"
        style={{ width: 4, backgroundColor: read ? "#D7DEE8" : look.tone }}
      />

      <View
        className="w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: read ? "#F2F4F7" : look.wash }}
      >
        <Ionicons
          name={look.glyph}
          size={20}
          color={read ? "#98A2B3" : look.tone}
        />
      </View>

      <View className="flex-1 min-w-0">
        <View className="flex-row items-center justify-between gap-2">
          <Text
            className={
              read
                ? "text-[13.5px] font-bold text-safeplus-muted flex-1"
                : "text-[13.5px] font-extrabold text-safeplus-navy flex-1"
            }
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text className="text-[11px] font-semibold text-safeplus-muted">
            {timeAgo(item.createdAt)}
          </Text>
        </View>
        <Text
          className={
            read
              ? "text-[12.5px] text-safeplus-muted mt-1 leading-[18px]"
              : "text-[12.5px] text-safeplus-text mt-1 leading-[18px]"
          }
        >
          {item.message}
        </Text>

        <View className="flex-row items-center mt-2.5">
          <Text
            className="text-[11px] font-extrabold uppercase tracking-[0.5px]"
            style={{ color: read ? "#98A2B3" : look.tone }}
          >
            Open mission
          </Text>
          <Ionicons
            name="chevron-forward"
            size={13}
            color={read ? "#98A2B3" : look.tone}
            style={{ marginLeft: 2 }}
          />
          {!read && (
            <View
              className="w-2 h-2 rounded-full ml-auto"
              style={{ backgroundColor: look.tone }}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}
