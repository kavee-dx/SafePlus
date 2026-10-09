import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  STAGE_ACTIONS,
  STAGE_LABELS,
  type DispatchStatus,
  type LeaderWorkspace,
  type MissionRoll,
  type StageUpdate,
  stageColor,
} from "../services/kaveesha-leaderApi";

/* ------------------------------------------------------------------ *
 * The mission screen — the one thing a team leader opens in the field.
 *
 * Everything is built for a wet thumb on a shaking phone in a vehicle: a big
 * scene card up top, the single action the leader can take next as an enormous
 * button, and the route and the control room one tap away. No menus to dig
 * through and no small targets.
 * ------------------------------------------------------------------ */

interface MissionScreenProps {
  workspace: LeaderWorkspace;
  busy: boolean;
  onStage: (update: StageUpdate) => Promise<void>;
  /** The "we reached the shelter" tap. Resolves with the server's message;
   *  throws so the card can show the reason without a second round-trip. */
  onReportArrival: () => Promise<string>;
}

/** "just now / 4 min ago / 2 h ago / 3 d ago", said short. */
function ago(value: string | null | undefined): string {
  if (!value) return "—";

  const at = new Date(value).getTime();

  if (!Number.isFinite(at)) return "—";

  const minutes = Math.max(0, Math.round((Date.now() - at) / 60000));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours} h ago`;

  return `${Math.round(hours / 24)} d ago`;
}

function humanizeHazard(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const SEVERITY_TONE: Record<string, { bg: string; fg: string }> = {
  CRITICAL: { bg: "#FEE4E2", fg: "#B42318" },
  HIGH: { bg: "#FFE4DA", fg: "#C4320A" },
  MODERATE: { bg: "#FEF0C7", fg: "#B54708" },
  LOW: { bg: "#DCFCE7", fg: "#14532D" },
};

export default function KaveeshaLeaderMissionScreen({
  workspace,
  busy,
  onStage,
  onReportArrival,
}: MissionScreenProps) {
  const insets = useSafeAreaInsets();
  const active = workspace.active;
  const [note, setNote] = useState("");
  const [rescued, setRescued] = useState("");
  const [evacuated, setEvacuated] = useState("");

  const nextActions = useMemo(
    () =>
      workspace.nextStatuses
        .map((status) => ({ status, meta: STAGE_ACTIONS[status] }))
        .filter((item) => Boolean(item.meta)),
    [workspace.nextStatuses]
  );

  const scene = buildScene(active);

  const submitStage = async (status: DispatchStatus) => {
    const update: StageUpdate = { status };

    const trimmed = note.trim();

    if (trimmed !== "") update.note = trimmed;

    const rescuedNumber = Number(rescued);
    const evacuatedNumber = Number(evacuated);

    if (Number.isInteger(rescuedNumber) && rescuedNumber >= 0 && rescued.trim() !== "") {
      update.peopleRescued = rescuedNumber;
    }

    if (
      Number.isInteger(evacuatedNumber) &&
      evacuatedNumber >= 0 &&
      evacuated.trim() !== ""
    ) {
      update.peopleEvacuated = evacuatedNumber;
    }

    await onStage(update);

    setNote("");
    setRescued("");
    setEvacuated("");
  };

  const openRoute = async () => {
    if (!scene?.destination) return;

    const { lat, lng } = scene.destination;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    await Linking.openURL(url);
  };

  const call = async (phone: string) => {
    await Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`);
  };

  if (!active) {
    return (
      <ScrollView
        className="flex-1 bg-safeplus-background"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
      >
        <StandbyCard teamName={workspace.team.name} />
      </ScrollView>
    );
  }

  const tone = SEVERITY_TONE[(active.severityLevel ?? "").toUpperCase()] ?? SEVERITY_TONE.MODERATE;

  return (
    <ScrollView
      className="flex-1 bg-safeplus-background"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120, paddingHorizontal: 16 }}
    >
      {/* Tasked banner */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-[11px] font-extrabold uppercase tracking-widest text-safeplus-muted">
          You have been tasked
        </Text>
        <Text className="text-[11px] font-bold text-safeplus-muted">
          {ago(active.createdAt)}
        </Text>
      </View>

      {/* The scene card */}
      <View className="rounded-3xl bg-safeplus-white p-5 shadow-sm border border-safeplus-border">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[19px] font-extrabold text-safeplus-navy leading-7">
              {humanizeHazard(active.hazardType)}
            </Text>
            <Text className="text-[13px] font-semibold text-safeplus-muted mt-1">
              {active.reportPublicId} · {active.district} District
            </Text>
          </View>
          <View
            className="px-3 py-1.5 rounded-full"
            style={{ backgroundColor: tone.bg }}
          >
            <Text className="text-[11px] font-extrabold uppercase" style={{ color: tone.fg }}>
              {active.severityLevel}
            </Text>
          </View>
        </View>

        {active.immediateDanger && (
          <View className="flex-row items-center gap-2 mt-3 px-3 py-2 rounded-xl bg-safeplus-lightRed">
            <Ionicons name="warning" size={15} color="#B42318" />
            <Text className="text-[12.5px] font-bold text-safeplus-red">
              Danger to life reported
            </Text>
          </View>
        )}

        <View className="flex-row items-start gap-2 mt-4">
          <Ionicons name="location-outline" size={17} color="#667085" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[14px] text-safeplus-text font-semibold">
            {active.landmark || "No landmark given"}
          </Text>
        </View>

        {scene && (
          <Text className="text-[12px] text-safeplus-muted mt-1 ml-6">
            {scene.destination
              ? `${scene.destination.lat.toFixed(5)}, ${scene.destination.lng.toFixed(5)}`
              : "No map point saved on this incident"}
          </Text>
        )}

        {Boolean(active.missionNotes) && (
          <View className="mt-4 px-3.5 py-3 rounded-2xl bg-safeplus-paleGreen border border-safeplus-lightGreen">
            <Text className="text-[10.5px] font-extrabold uppercase tracking-wide text-safeplus-darkGreen mb-1">
              Orders from {active.dispatchedByName || "the district"}
            </Text>
            <Text className="text-[13.5px] text-safeplus-navy leading-5">
              {active.missionNotes}
            </Text>
          </View>
        )}

        {/* Scene actions */}
        <View className="flex-row gap-2.5 mt-4">
          <Pressable
            onPress={openRoute}
            disabled={!scene?.destination}
            accessibilityRole="button"
            className={
              "flex-1 flex-row items-center justify-center gap-2 h-12 rounded-2xl " +
              (scene?.destination ? "bg-safeplus-blue active:opacity-80" : "bg-safeplus-border")
            }
          >
            <Ionicons name="navigate" size={17} color={scene?.destination ? "#FFFFFF" : "#98A2B3"} />
            <Text
              className="text-[14px] font-extrabold"
              style={{ color: scene?.destination ? "#FFFFFF" : "#98A2B3" }}
            >
              Open route
            </Text>
          </Pressable>

          {Boolean(active.controlPhone) && (
            <Pressable
              onPress={() => void call(active.controlPhone as string)}
              accessibilityRole="button"
              className="flex-1 flex-row items-center justify-center gap-2 h-12 rounded-2xl bg-safeplus-white border border-safeplus-border active:opacity-80"
            >
              <Ionicons name="call" size={16} color="#0F172A" />
              <Text className="text-[14px] font-extrabold text-safeplus-navy">Control</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Where the mission is now */}
      <StageTrail roll={active} />

      {/* Once the rescue is done the group needs a roof: report you reached the
          shelter so the desk knows people are at the door before the manager
          confirms the headcount. */}
      {active.status === "COMPLETED" && (
        <ShelterArrivalCard onReport={onReportArrival} busy={busy} />
      )}

      {/* The action(s) the leader is allowed to take next */}
      <Text className="text-[13px] font-extrabold text-safeplus-navy mt-5 mb-2">
        {nextActions.length > 0 ? "What happens next" : "Awaiting the district"}
      </Text>

      {nextActions.length === 0 ? (
        <View className="rounded-2xl bg-safeplus-white border border-safeplus-border p-4">
          <Text className="text-[13.5px] text-safeplus-muted leading-5">
            There is nothing for you to tap right now. The district may re-task or stand
            this mission down — you will be told the moment that happens.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {needsCounts(nextActions) && (
            <CountFields
              rescued={rescued}
              evacuated={evacuated}
              setRescued={setRescued}
              setEvacuated={setEvacuated}
            />
          )}

          <NoteField note={note} setNote={setNote} />

          {nextActions.map(({ status, meta }) => (
            <ActionButton
              key={status}
              status={status}
              label={meta.label}
              hint={meta.hint}
              busy={busy}
              onPress={() => void submitStage(status)}
            />
          ))}
        </View>
      )}

      {busy && (
        <View className="flex-row items-center justify-center gap-2 mt-5">
          <ActivityIndicator size="small" color="#1570EF" />
          <Text className="text-[12.5px] font-semibold text-safeplus-muted">
            Sending your update…
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ *
 * Small pieces.
 * ------------------------------------------------------------------ */

function needsCounts(actions: { status: DispatchStatus }[]): boolean {
  return actions.some((action) => STAGE_ACTIONS[action.status]?.needsCounts);
}

function buildScene(roll: MissionRoll | null) {
  if (!roll) return null;

  const lat = roll.incidentLat;
  const lng = roll.incidentLng;
  const has = typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);

  return has ? { destination: { lat: lat as number, lng: lng as number } } : { destination: null };
}

function ActionButton({
  status,
  label,
  hint,
  busy,
  onPress,
}: {
  status: DispatchStatus;
  label: string;
  hint: string;
  busy: boolean;
  onPress: () => void;
}) {
  const isDecline = status === "DECLINED";
  const bg = isDecline ? "#FFFFFF" : stageColor(status);

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      className={
        "rounded-2xl p-4 active:opacity-90 " +
        (isDecline ? "bg-safeplus-white border border-safeplus-border" : "shadow-sm")
      }
      style={{ backgroundColor: bg }}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className="text-[17px] font-extrabold"
          style={{ color: isDecline ? "#98A2B3" : "#FFFFFF" }}
        >
          {label}
        </Text>
        <Ionicons
          name={isDecline ? "close-circle-outline" : "chevron-forward"}
          size={22}
          color={isDecline ? "#98A2B3" : "#FFFFFF"}
        />
      </View>
      <Text
        className="text-[12.5px] mt-1 leading-[17px]"
        style={{ color: isDecline ? "#98A2B3" : "rgba(255,255,255,0.9)" }}
      >
        {hint}
      </Text>
    </Pressable>
  );
}

function NoteField({
  note,
  setNote,
}: {
  note: string;
  setNote: (value: string) => void;
}) {
  return (
    <TextInput
      value={note}
      onChangeText={setNote}
      multiline
      maxLength={300}
      placeholder="Add a note for the district (optional) — e.g. two boats needed."
      placeholderTextColor="#98A2B3"
      className="rounded-2xl bg-safeplus-white border border-safeplus-border px-4 py-3 text-[14px] text-safeplus-text min-h-[52px]"
      textAlignVertical="top"
    />
  );
}

function CountFields({
  rescued,
  evacuated,
  setRescued,
  setEvacuated,
}: {
  rescued: string;
  evacuated: string;
  setRescued: (value: string) => void;
  setEvacuated: (value: string) => void;
}) {
  return (
    <View className="flex-row gap-3">
      <CountInput
        label="Rescued"
        value={rescued}
        onChange={setRescued}
        icon="people"
        color="#16A34A"
      />
      <CountInput
        label="Evacuated"
        value={evacuated}
        onChange={setEvacuated}
        icon="walk"
        color="#1570EF"
      />
    </View>
  );
}

function CountInput({
  label,
  value,
  onChange,
  icon,
  color,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View className="flex-1 rounded-2xl bg-safeplus-white border border-safeplus-border p-3.5">
      <View className="flex-row items-center gap-1.5 mb-1.5">
        <Ionicons name={icon} size={15} color={color} />
        <Text className="text-[11px] font-extrabold uppercase tracking-wide text-safeplus-muted">
          {label}
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor="#D0D5DD"
        className="text-[22px] font-extrabold text-safeplus-navy"
      />
    </View>
  );
}

function StageTrail({ roll }: { roll: MissionRoll }) {
  const ordered: DispatchStatus[] = [
    "DISPATCHED",
    "ACCEPTED",
    "EN_ROUTE",
    "ARRIVED",
    "RESCUE_IN_PROGRESS",
    "RETURNING",
    "COMPLETED",
  ];

  const current = ordered.indexOf(roll.status);
  const steps = current >= 0 ? ordered : ordered.slice(0, Math.max(ordered.indexOf("RETURNING") + 1, 1));

  return (
    <View className="mt-4 rounded-2xl bg-safeplus-white border border-safeplus-border p-4">
      <Text className="text-[11px] font-extrabold uppercase tracking-wide text-safeplus-muted mb-3">
        This mission · {STAGE_LABELS[roll.status]} · {ago(roll.updatedAt)}
      </Text>

      <View className="flex-row items-center">
        {steps.map((step, index) => {
          const done = index <= current;
          const isLast = index === steps.length - 1;

          return (
            <View key={step} className="flex-row items-center flex-1">
              <View
                className="items-center justify-center rounded-full"
                style={{
                  width: 22,
                  height: 22,
                  backgroundColor: done ? stageColor(roll.status) : "#EAECF0",
                }}
              >
                {done && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
              </View>
              {!isLast && (
                <View
                  className="flex-1 h-[3px] rounded-full"
                  style={{ backgroundColor: index < current ? stageColor(roll.status) : "#EAECF0" }}
                />
              )}
            </View>
          );
        })}
      </View>

      <Text className="text-[13px] text-safeplus-navy font-semibold mt-3">
        {STAGE_LABELS[roll.status]}
        {roll.peopleRescued || roll.peopleEvacuated
          ? ` · ${roll.peopleRescued ?? 0} rescued, ${roll.peopleEvacuated ?? 0} evacuated`
          : ""}
      </Text>
    </View>
  );
}

function ShelterArrivalCard({
  onReport,
  busy,
}: {
  onReport: () => Promise<string>;
  busy: boolean;
}) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const report = async () => {
    if (state === "sending") return;

    setState("sending");
    setError(null);

    try {
      const text = await onReport();

      setMessage(text);
      setState("done");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "That arrival could not be sent. Try again."
      );
      setState("idle");
    }
  };

  const done = state === "done";

  return (
    <View className="mt-4 rounded-2xl bg-safeplus-white border border-safeplus-border p-4">
      <View className="flex-row items-center gap-2">
        <View className="w-9 h-9 rounded-full bg-safeplus-lightBlue items-center justify-center">
          <Ionicons name="business-outline" size={18} color="#1570EF" />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-extrabold text-safeplus-navy">
            Brought everyone to a shelter
          </Text>
          <Text className="text-[12.5px] text-safeplus-muted mt-0.5 leading-[17px]">
            Take the group to the shelter the district assigned, then tap to tell
            them you have arrived. The shelter manager confirms the headcount.
          </Text>
        </View>
      </View>

      {done && message ? (
        <View className="mt-3 px-3.5 py-2.5 rounded-xl bg-safeplus-paleGreen border border-safeplus-lightGreen">
          <Text className="text-[12.5px] font-semibold text-safeplus-darkGreen">
            {message}
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={() => void report()}
          disabled={busy || state === "sending"}
          accessibilityRole="button"
          className={
            "mt-3 flex-row items-center justify-center gap-2 h-12 rounded-2xl active:opacity-90 " +
            (state === "sending" ? "bg-safeplus-border" : "bg-safeplus-navy")
          }
        >
          {state === "sending" ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
          )}
          <Text className="text-[14px] font-extrabold text-white">
            {state === "sending" ? "Reporting…" : "Report arrival at shelter"}
          </Text>
        </Pressable>
      )}

      {error && (
        <Text className="text-[12.5px] font-semibold text-safeplus-red mt-2">{error}</Text>
      )}
    </View>
  );
}

function StandbyCard({ teamName }: { teamName: string }) {
  return (
    <View className="px-4">
      <View className="items-center rounded-3xl bg-safeplus-white border border-safeplus-border px-6 py-10">
        <View className="w-16 h-16 rounded-full bg-safeplus-lightGreen items-center justify-center mb-4">
          <Ionicons name="radio-outline" size={30} color="#16A34A" />
        </View>
        <Text className="text-[18px] font-extrabold text-safeplus-navy">
          {teamName} is standing by
        </Text>
        <Text className="text-[13.5px] text-safeplus-muted text-center mt-2 leading-5">
          No mission right now. When the district tasks your team you will get a
          notification on this phone — keep it on and the sound up.
        </Text>
      </View>
    </View>
  );
}
