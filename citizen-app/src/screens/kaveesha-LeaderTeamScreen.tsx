import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  LeaderApiError,
  type AvailabilityState,
  type TeamDashboard,
  fetchTeamDashboard,
  updateAvailability,
} from "../services/kaveesha-leaderApi";

/* ------------------------------------------------------------------ *
 * The team at a glance (UC-03, mobile).
 *
 * Who the team is, what it can do, and the one switch that matters when there
 * is no mission running: whether the district is allowed to task them. Being
 * honest about availability is what keeps a tired team off a job it cannot take.
 * ------------------------------------------------------------------ */

const OPTIONS: {
  key: AvailabilityState;
  label: string;
  hint: string;
  dot: string;
}[] = [
  {
    key: "AVAILABLE",
    label: "Available",
    hint: "Ready to be tasked by the district.",
    dot: "#16A34A",
  },
  {
    key: "ON_DEPLOYMENT",
    label: "On deployment",
    hint: "Out on work — take this only if you can still respond.",
    dot: "#F79009",
  },
  {
    key: "UNAVAILABLE",
    label: "Unavailable",
    hint: "Resting or off-duty. You will not be tasked.",
    dot: "#98A2B3",
  },
];

export default function KaveeshaLeaderTeamScreen({ token }: { token: string }) {
  const insets = useSafeAreaInsets();
  const [dashboard, setDashboard] = useState<TeamDashboard | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<AvailabilityState | null>(null);

  const load = useCallback(() => {
    setReady(false);

    fetchTeamDashboard(token)
      .then((data) => {
        setDashboard(data);
        setError(null);
      })
      .catch((cause: LeaderApiError) => setError(cause.message))
      .finally(() => setReady(true));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const choose = async (state: AvailabilityState) => {
    if (saving) return;

    setSaving(state);
    setError(null);

    try {
      const data = await updateAvailability(token, state);

      setDashboard(data);
    } catch (cause) {
      setError(
        cause instanceof LeaderApiError
          ? cause.message
          : "Availability could not be saved."
      );
    } finally {
      setSaving(null);
    }
  };

  if (!ready && !dashboard) {
    return (
      <View
        className="flex-1 items-center justify-center bg-safeplus-background"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator size="large" color="#1570EF" />
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View
        className="flex-1 items-center justify-center px-8 bg-safeplus-background"
        style={{ paddingTop: insets.top }}
      >
        <Ionicons name="cloud-offline-outline" size={30} color="#98A2B3" />
        <Text className="text-[14px] text-safeplus-muted text-center mt-3">
          {error ?? "Your team could not be read."}
        </Text>
        <Pressable
          onPress={load}
          className="mt-4 px-5 h-11 rounded-2xl bg-safeplus-navy items-center justify-center"
        >
          <Text className="text-white font-extrabold">Try again</Text>
        </Pressable>
      </View>
    );
  }

  const { team, leader, organization, account } = dashboard;

  return (
    <ScrollView
      className="flex-1 bg-safeplus-background"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120, paddingHorizontal: 16 }}
    >
      <Text className="text-[19px] font-extrabold text-safeplus-navy mb-1">{team.name}</Text>
      <Text className="text-[13px] text-safeplus-muted mb-4">
        {team.type} · {team.district} District · {team.size} members
      </Text>

      {/* Availability switch */}
      <View className="rounded-3xl bg-safeplus-white border border-safeplus-border p-4 mb-4">
        <Text className="text-[11px] font-extrabold uppercase tracking-wide text-safeplus-muted mb-3">
          Can the district task you?
        </Text>

        <View className="gap-2.5">
          {OPTIONS.map((option) => {
            const active = team.availability === option.key;

            return (
              <Pressable
                key={option.key}
                onPress={() => void choose(option.key)}
                disabled={saving !== null || active}
                className={
                  "flex-row items-center gap-3 rounded-2xl p-3.5 border " +
                  (active
                    ? "border-safeplus-navy bg-safeplus-paleGreen"
                    : "border-safeplus-border bg-safeplus-white active:opacity-90")
                }
              >
                <View
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: option.dot }}
                />
                <View className="flex-1">
                  <Text className="text-[15px] font-extrabold text-safeplus-navy">
                    {option.label}
                  </Text>
                  <Text className="text-[12px] text-safeplus-muted mt-0.5">
                    {option.hint}
                  </Text>
                </View>
                {saving === option.key ? (
                  <ActivityIndicator size="small" color="#1570EF" />
                ) : (
                  <Ionicons
                    name={active ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={active ? "#16A34A" : "#D0D5DD"}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {error && (
        <View className="rounded-2xl bg-safeplus-lightRed border border-safeplus-red p-3.5 mb-4">
          <Text className="text-[13px] font-semibold text-safeplus-red">{error}</Text>
        </View>
      )}

      {account.status !== "ACTIVE" && account.status !== "VERIFIED" && (
        <View className="rounded-2xl bg-safeplus-amberSoft border border-safeplus-yellow p-3.5 mb-4">
          <Text className="text-[13px] font-bold text-safeplus-amber">
            This team is {account.status.toLowerCase().replace(/_/g, " ")}.
          </Text>
          <Text className="text-[12.5px] text-safeplus-navy mt-1">
            {account.rejectionReason ??
              "Until it is verified the district cannot task it."}
          </Text>
        </View>
      )}

      {/* Capabilities + equipment */}
      <DetailCard
        title="What the team can do"
        icon="options-outline"
        items={team.capabilities}
        empty="No capabilities listed yet."
      />
      <DetailCard
        title="Equipment"
        icon="construct-outline"
        items={team.equipment}
        empty="No equipment listed yet."
      />

      {/* Contact */}
      <View className="rounded-3xl bg-safeplus-white border border-safeplus-border p-4 mt-3">
        <Text className="text-[11px] font-extrabold uppercase tracking-wide text-safeplus-muted mb-3">
          In touch
        </Text>
        <Row icon="person-outline" label={leader.fullName} value={leader.designation ?? "Team leader"} />
        <Row icon="call-outline" label="Leader" value={leader.phone} />
        {team.contactNumber && <Row icon="chatbubble-ellipses-outline" label="Team line" value={team.contactNumber} />}
        <Row icon="mail-outline" label="Email" value={leader.email} />
        {organization && <Row icon="business-outline" label="Organization" value={organization.name} />}
        {team.base?.label && <Row icon="pin-outline" label="Base" value={team.base.label} />}
      </View>
    </ScrollView>
  );
}

function DetailCard({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: string[];
  empty: string;
}) {
  return (
    <View className="rounded-3xl bg-safeplus-white border border-safeplus-border p-4 mt-3">
      <View className="flex-row items-center gap-2 mb-3">
        <Ionicons name={icon} size={16} color="#667085" />
        <Text className="text-[11px] font-extrabold uppercase tracking-wide text-safeplus-muted">
          {title}
        </Text>
      </View>

      {items.length === 0 ? (
        <Text className="text-[13px] text-safeplus-muted">{empty}</Text>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {items.map((item) => (
            <View
              key={item}
              className="px-3 py-1.5 rounded-full bg-safeplus-blueSoft"
            >
              <Text className="text-[12.5px] font-bold text-safeplus-navy">{item}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-3 py-2">
      <Ionicons name={icon} size={17} color="#98A2B3" />
      <Text className="text-[13px] text-safeplus-muted w-24">{label}</Text>
      <Text className="flex-1 text-[13.5px] font-semibold text-safeplus-navy">{value}</Text>
    </View>
  );
}
