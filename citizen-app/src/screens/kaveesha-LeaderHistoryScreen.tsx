import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  STAGE_LABELS,
  type MissionRoll,
  stageColor,
} from "../services/kaveesha-leaderApi";

/* ------------------------------------------------------------------ *
 * What the team has done (UC-03, mobile).
 *
 * A short, honest ledger. A leader coming off a long night wants to see the
 * missions behind them and the numbers they reported, without any of the
 * control-room chrome.
 * ------------------------------------------------------------------ */

interface HistoryScreenProps {
  history: MissionRoll[];
}

function dayLabel(value: string): string {
  const at = new Date(value);

  if (!Number.isFinite(at.getTime())) return "—";

  return at.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function KaveeshaLeaderHistoryScreen({ history }: HistoryScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1 bg-safeplus-background"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120, paddingHorizontal: 16 }}
    >
      <Text className="text-[19px] font-extrabold text-safeplus-navy mb-1">
        Past missions
      </Text>
      <Text className="text-[13px] text-safeplus-muted mb-4">
        The {history.length === 1 ? "mission" : "missions"} your team has closed.
      </Text>

      {history.length === 0 ? (
        <View className="items-center rounded-3xl bg-safeplus-white border border-safeplus-border px-6 py-10">
          <Ionicons name="time-outline" size={30} color="#98A2B3" />
          <Text className="text-[14px] font-semibold text-safeplus-muted text-center mt-3 leading-5">
            Nothing finished yet. Your completed missions will show up here.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {history.map((roll) => (
            <HistoryCard key={roll.id} roll={roll} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function HistoryCard({ roll }: { roll: MissionRoll }) {
  const closed = roll.status === "COMPLETED";
  const stoodDown = roll.status === "CANCELLED" || roll.status === "DECLINED";

  return (
    <View className="rounded-2xl bg-safeplus-white border border-safeplus-border p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: stageColor(roll.status) }}
          />
          <Text className="text-[14px] font-extrabold text-safeplus-navy">
            {roll.dispatchCode}
          </Text>
        </View>
        <Text className="text-[12px] font-bold" style={{ color: stageColor(roll.status) }}>
          {STAGE_LABELS[roll.status]}
        </Text>
      </View>

      <Text className="text-[13.5px] text-safeplus-text font-semibold mt-2">
        {roll.hazardType.replace(/_/g, " ")} · {roll.reportPublicId}
      </Text>
      <Text className="text-[12px] text-safeplus-muted mt-0.5">
        {roll.district} District · {dayLabel(roll.updatedAt)}
      </Text>

      {closed && (
        <View className="flex-row gap-2 mt-3">
          <Chip icon="people" tone="#16A34A" text={`${roll.peopleRescued ?? 0} rescued`} />
          <Chip icon="walk" tone="#1570EF" text={`${roll.peopleEvacuated ?? 0} evacuated`} />
        </View>
      )}

      {stoodDown && Boolean(roll.cancelReason || roll.declineReason) && (
        <Text className="text-[12px] text-safeplus-muted mt-2 italic">
          {roll.cancelReason || roll.declineReason}
        </Text>
      )}
    </View>
  );
}

function Chip({
  icon,
  tone,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  text: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-safeplus-paleGreen">
      <Ionicons name={icon} size={13} color={tone} />
      <Text className="text-[12px] font-bold text-safeplus-navy">{text}</Text>
    </View>
  );
}
