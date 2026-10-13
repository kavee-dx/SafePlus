import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MissionMap from "./kaveesha-MissionMap";

import {
  STAGE_ACTIONS,
  STAGE_LABELS,
  type DispatchStatus,
  type LeaderWorkspace,
  type MissionRoll,
  type ShelterAssignment,
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
  /** The "accept, heading to shelter" tap (group -> IN_TRANSIT). Same contract. */
  onAckShelter: () => Promise<string>;
  /** The "these beds don't work" tap — releases the plan so the district can
   *  reassign (group -> DECLINED). Same contract. */
  onRejectShelter: () => Promise<string>;
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

/* A hazard's glyph, so the hero reads the disaster kind at a glance. */
const HAZARD_GLYPH: Record<string, keyof typeof Ionicons.glyphMap> = {
  FLOOD: "water-outline",
  LANDSLIDE: "trending-down-outline",
  CYCLONE: "thunderstorm-outline",
  EARTHQUAKE: "pulse-outline",
  TSUNAMI: "water-outline",
  FIRE: "flame-outline",
  EPIDEMIC: "medkit-outline",
  STRUCTURAL_FAILURE: "business-outline",
};

/* One elevated surface language for the whole board: a near-white card, a hairline
   border and a soft, real shadow. Reused everywhere so the screen feels cohesive. */
const INK = "#0B1B34";
const CARD = StyleSheet.create({
  surface: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E4E9F2",
    // iOS shadow
    shadowColor: "#0B1B34",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    // Android elevation
    elevation: 3,
  },
});

function hazardGlyph(value: string): keyof typeof Ionicons.glyphMap {
  return HAZARD_GLYPH[(value ?? "").toUpperCase()] ?? "alert-circle-outline";
}

export default function KaveeshaLeaderMissionScreen({
  workspace,
  busy,
  onStage,
  onReportArrival,
  onAckShelter,
  onRejectShelter,
}: MissionScreenProps) {
  const insets = useSafeAreaInsets();
  const active = workspace.active;
  const [note, setNote] = useState("");
  const [rescued, setRescued] = useState("");
  const [evacuated, setEvacuated] = useState("");

  // One guided step at a time: the phone shows the single next stage in the
  // mission path (plus Decline while the tasking is still open), never the whole
  // menu the server allows. That is why the head-count fields only appear when
  // there is genuinely a mission to complete — after the team has arrived.
  const nextActions = useMemo(() => {
    const available = workspace.nextStatuses.filter((status) => Boolean(STAGE_ACTIONS[status]));
    const list: { status: DispatchStatus; meta: (typeof STAGE_ACTIONS)[string] }[] = [];

    const forward = FORWARD_ORDER.find((status) => available.includes(status));

    if (forward) list.push({ status: forward, meta: STAGE_ACTIONS[forward] });
    if (available.includes("DECLINED")) list.push({ status: "DECLINED", meta: STAGE_ACTIONS.DECLINED });

    return list;
  }, [workspace.nextStatuses]);

  const scene = buildScene(active);

  // Once the district allocates a shelter, the mission's driving target flips from
  // the incident to the shelter. The largest allocation is the map; any second
  // shelter is offered as its own navigate entry below (a split plan).
  const assignments = active?.shelterAssignment ?? [];
  const primaryShelter = pickPrimaryShelter(assignments);
  const mapTarget = resolveMapTarget(primaryShelter, scene, active?.landmark);

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

  const openRoute = async (destination?: { lat: number; lng: number } | null) => {
    const target = destination ?? mapTarget;

    if (!target) return;

    const { lat, lng } = target;
    // Universal Google Maps deep link: opens the installed Maps app with the
    // route drawn and turn-by-turn ready, and falls back to the browser if not.
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`;

    try {
      await Linking.openURL(url);
    } catch {
      // A phone with no maps handler should still tell the leader, not crash.
    }
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
      {/* The scene, painted: the incident photo under a scrim, the disaster and
          its severity read at a glance, the orders and the route one tap away. */}
      <View style={{ ...CARD.surface, marginBottom: 14, padding: 0, overflow: "hidden" }}>
        <View style={{ height: 150, backgroundColor: INK, justifyContent: "flex-end", padding: 16 }}>
          {/* hazard glyph watermark */}
          <View pointerEvents="none" style={{ position: "absolute", right: -8, top: -14, opacity: 0.16 }}>
            <Ionicons name={hazardGlyph(active.hazardType)} size={132} color="#FFFFFF" />
          </View>

          {/* status chips */}
          <View className="flex-row items-center justify-between" style={{ position: "absolute", top: 14, left: 14, right: 14 }}>
            <View className="flex-row items-center gap-1.5 px-3 py-1.5" style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999 }}>
              <Ionicons name="radio-button-on" size={13} color="#FFD166" />
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 11, letterSpacing: 0.6 }}>
                TASKED · {ago(active.createdAt)}
              </Text>
            </View>
            <View className="px-3 py-1.5" style={{ backgroundColor: tone.bg, borderRadius: 999 }}>
              <Text style={{ color: tone.fg, fontWeight: "900", fontSize: 11, letterSpacing: 0.4 }}>
                {active.severityLevel}
              </Text>
            </View>
          </View>

          {/* title */}
          <View className="flex-row items-center gap-2">
            <Ionicons name={hazardGlyph(active.hazardType)} size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 21, fontWeight: "900", lineHeight: 26 }}>
              {humanizeHazard(active.hazardType)}
            </Text>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 12.5, fontWeight: "700", marginTop: 3 }}>
            {active.reportPublicId} · {active.district} District
            {active.affectedPopulation ? ` · ${active.affectedPopulation} affected` : ""}
          </Text>
        </View>

        <View style={{ padding: 16 }}>
          {active.immediateDanger && (
            <View className="flex-row items-center gap-2 mb-3 px-3 py-2.5" style={{ backgroundColor: "#FEF3F2", borderRadius: 16 }}>
              <Ionicons name="warning" size={16} color="#B42318" />
              <Text style={{ color: "#B42318", fontWeight: "800", fontSize: 12.5 }}>
                Danger to life reported at this scene
              </Text>
            </View>
          )}

          {/* The scene on a real map — a still pin over the location; tapping the
              tile hands the route to the maps app. Native map on device, a clean
              fallback on web (see kaveesha-MissionMap). Once a shelter is assigned
              the pin moves to the shelter — that is where the team drives now. */}
          {mapTarget ? (
            <>
              <MissionMap
                destination={{ lat: mapTarget.lat, lng: mapTarget.lng }}
                title={mapTarget.title}
                description={
                  mapTarget.isShelter
                    ? "Shelter the district assigned"
                    : `${humanizeHazard(active.hazardType)} · ${active.severityLevel}`
                }
                onPress={() => void openRoute()}
              />
              {mapTarget.isShelter ? (
                <View className="flex-row items-center gap-1.5 mt-2">
                  <Ionicons name="business-outline" size={13} color="#1570EF" />
                  <Text style={{ color: "#1570EF", fontSize: 12, fontWeight: "800" }}>
                    Now driving to {mapTarget.title}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={{ color: "#98A2B3", fontSize: 12, fontWeight: "600", marginBottom: 12, paddingHorizontal: 4 }}>
              No map point saved on this incident
            </Text>
          )}

          {/* Primary navigate action + control room */}
          <View className="flex-row gap-2.5 mt-3">
            <Pressable
              onPress={() => void openRoute()}
              disabled={!mapTarget}
              accessibilityRole="button"
              className="flex-row items-center justify-center flex-1 gap-2 active:opacity-90"
              style={{ height: 52, borderRadius: 16, backgroundColor: mapTarget ? INK : "#EAECF0" }}
            >
              <Ionicons name="navigate" size={18} color={mapTarget ? "#FFFFFF" : "#98A2B3"} />
              <Text style={{ color: mapTarget ? "#FFFFFF" : "#98A2B3", fontSize: 15, fontWeight: "900" }}>
                {mapTarget?.isShelter ? "Navigate to shelter" : "Navigate to scene"}
              </Text>
            </Pressable>

            {Boolean(active.controlPhone) && (
              <Pressable
                onPress={() => void call(active.controlPhone as string)}
                accessibilityRole="button"
                className="flex-row items-center justify-center active:opacity-80"
                style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4E9F2" }}
              >
                <Ionicons name="call" size={19} color={INK} />
              </Pressable>
            )}
          </View>

          {Boolean(active.missionNotes) && (
            <View className="mt-4 p-3.5" style={{ backgroundColor: "#F4FBF6", borderRadius: 18, borderWidth: 1, borderColor: "#DCFCE7" }}>
              <Text style={{ color: "#14532D", fontSize: 10.5, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 3 }}>
                Orders · {active.dispatchedByName || "the district"}
              </Text>
              <Text style={{ color: INK, fontSize: 13.5, lineHeight: 19 }}>
                {active.missionNotes}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* The incident photo, shown big on its own — what the scene looks like,
          straight from what the citizens on the ground sent. */}
      {active.thumbnailUrl ? (
        <View style={{ ...CARD.surface, marginBottom: 14, padding: 0, overflow: "hidden" }}>
          <Image
            source={{ uri: active.thumbnailUrl }}
            resizeMode="cover"
            style={{ width: "100%", height: 280 }}
          />
          <View className="flex-row items-center gap-2" style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <Ionicons name="image-outline" size={15} color="#475467" />
            <Text style={{ color: "#475467", fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
              Incident photo · from the scene report
            </Text>
          </View>
        </View>
      ) : null}

      {/* Where the mission is now */}
      <StageTrail roll={active} />

      {/* Once the rescue has people to shelter, the district allocates beds while
          the team is still Returning. As soon as a shelter is assigned, show where
          to drive, accept the plan and report arrival — then the mission completes. */}
      {assignments.length > 0 ? (
        <ShelterPanel
          assignments={assignments}
          groupStatus={active.groupStatus ?? null}
          busy={busy}
          onNavigate={(destination) => void openRoute(destination)}
          onAck={onAckShelter}
          onReject={onRejectShelter}
          onReport={onReportArrival}
        />
      ) : null}

      {(active.status === "RETURNING" || active.status === "COMPLETED") &&
      assignments.length === 0 ? (
        <AwaitingShelterCard declined={active.groupStatus === "DECLINED"} />
      ) : null}

      {/* The action(s) the leader is allowed to take next */}
      <Text className="text-[15px] font-extrabold text-safeplus-navy mt-1 mb-3">
        {nextActions.length > 0 ? "What happens next" : "Awaiting the district"}
      </Text>

      {nextActions.length === 0 ? (
        <View style={{ ...CARD.surface, padding: 16 }}>
          <Text style={{ color: "#5B6B7F", fontSize: 13.5, lineHeight: 20 }}>
            There is nothing for you to tap right now. The district may re-task or
            stand this mission down — you will be told the moment that happens.
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

/* The mission path in the order a leader walks it. The phone advances one step at
   a time, so this decides which single button is the "next" one. */
const FORWARD_ORDER: DispatchStatus[] = [
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "RESCUE_IN_PROGRESS",
  "RETURNING",
  "COMPLETED",
];

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
  // Every action that moves the mission forward is a go — green; declining is the
  // only stop — red. All render as solid, white-on-colour buttons so intent is clear.
  const bg = isDecline ? "#D92D20" : "#16A34A";

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      className="flex-row items-center gap-3 active:opacity-90"
      style={{
        padding: 14,
        borderRadius: 18,
        backgroundColor: bg,
        shadowColor: bg,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
      }}
    >
      <View
        className="items-center justify-center"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: "rgba(255,255,255,0.22)",
        }}
      >
        <Ionicons name={isDecline ? "close" : "arrow-forward"} size={20} color="#FFFFFF" />
      </View>

      <View className="flex-1">
        <Text style={{ color: "#FFFFFF", fontSize: 16.5, fontWeight: "900" }}>{label}</Text>
        <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>
          {hint}
        </Text>
      </View>
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
    <View style={{ ...CARD.surface, flex: 1, padding: 14 }}>
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
    <View style={{ ...CARD.surface, padding: 16, marginBottom: 14 }}>
      <View className="flex-row items-center justify-between mb-4">
        <Text style={{ color: "#7A8699", fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>
          Mission progress
        </Text>
        <View
          className="flex-row items-center gap-1.5 px-2.5 py-1"
          style={{ backgroundColor: `${stageColor(roll.status)}1A`, borderRadius: 999 }}
        >
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stageColor(roll.status) }} />
          <Text style={{ color: stageColor(roll.status), fontSize: 11.5, fontWeight: "900" }}>
            {STAGE_LABELS[roll.status]}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center">
        {steps.map((step, index) => {
          const done = index <= current;
          const isLast = index === steps.length - 1;

          return (
            <View key={step} className="flex-row items-center flex-1">
              <View
                className="items-center justify-center rounded-full"
                style={{
                  width: 24,
                  height: 24,
                  backgroundColor: done ? INK : "#EAECF0",
                }}
              >
                {done && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
              </View>
              {!isLast && (
                <View
                  className="flex-1 h-[3px] rounded-full"
                  style={{ backgroundColor: index < current ? INK : "#EAECF0" }}
                />
              )}
            </View>
          );
        })}
      </View>

      <Text style={{ color: "#7A8699", fontSize: 12, fontWeight: "600", marginTop: 14 }}>
        Updated {ago(roll.updatedAt)}
        {roll.peopleRescued || roll.peopleEvacuated
          ? ` · ${roll.peopleRescued ?? 0} rescued, ${roll.peopleEvacuated ?? 0} evacuated`
          : ""}
      </Text>
    </View>
  );
}

/* The shelter the map should drive to: prefer the allocation that carries the
   most people and has usable coordinates; fall back to any allocation, then to
   the incident. A split plan still shows the smaller shelter as its own line. */
function pickPrimaryShelter(assignments: ShelterAssignment[]): ShelterAssignment | null {
  if (assignments.length === 0) return null;

  const locatable = assignments.filter(
    (item) => typeof item.latitude === "number" && typeof item.longitude === "number"
  );
  const pool = locatable.length > 0 ? locatable : assignments;

  return pool.reduce((largest, item) => (item.allocatedCount > largest.allocatedCount ? item : largest));
}

function resolveMapTarget(
  primaryShelter: ShelterAssignment | null,
  scene: { destination: { lat: number; lng: number } | null } | null,
  landmark?: string | null
): { lat: number; lng: number; title: string; isShelter: boolean } | null {
  if (
    primaryShelter &&
    typeof primaryShelter.latitude === "number" &&
    typeof primaryShelter.longitude === "number"
  ) {
    return {
      lat: primaryShelter.latitude,
      lng: primaryShelter.longitude,
      title: primaryShelter.name,
      isShelter: true,
    };
  }

  if (scene?.destination) {
    return {
      lat: scene.destination.lat,
      lng: scene.destination.lng,
      title: landmark || "Incident location",
      isShelter: false,
    };
  }

  return null;
}

function ShelterPanel({
  assignments,
  groupStatus,
  busy,
  onNavigate,
  onAck,
  onReject,
  onReport,
}: {
  assignments: ShelterAssignment[];
  groupStatus: string | null;
  busy: boolean;
  onNavigate: (destination: { lat: number; lng: number }) => void;
  onAck: () => Promise<string>;
  onReject: () => Promise<string>;
  onReport: () => Promise<string>;
}) {
  const [ackState, setAckState] = useState<"idle" | "sending">("idle");
  const [ackError, setAckError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [rejectState, setRejectState] = useState<"idle" | "sending">("idle");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [reportState, setReportState] = useState<"idle" | "sending" | "done">("idle");
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // The group has moved past ALLOCATED once the leader has accepted; show that
  // state honestly rather than offering the accept button a second time.
  const heading = groupStatus === "IN_TRANSIT" || groupStatus === "ARRIVAL_REPORTED";

  const accept = async () => {
    if (ackState === "sending") return;

    setAckState("sending");
    setAckError(null);

    try {
      await onAck();
    } catch (cause) {
      setAckError(
        cause instanceof Error ? cause.message : "The shelter plan could not be accepted. Try again."
      );
    } finally {
      setAckState("idle");
    }
  };

  // Declining releases the assigned beds so the district can find better ones.
  // On success the plan is gone (the panel unmounts), so this only ever surfaces
  // a failure to retry.
  const decline = async () => {
    if (rejectState === "sending") return;

    setRejectState("sending");
    setRejectError(null);

    try {
      await onReject();
    } catch (cause) {
      setRejectError(
        cause instanceof Error ? cause.message : "The shelter plan could not be declined. Try again."
      );
      setDeclining(false);
    } finally {
      setRejectState("idle");
    }
  };

  const report = async () => {
    if (reportState === "sending") return;

    setReportState("sending");
    setReportError(null);

    try {
      const text = await onReport();

      setReportMessage(text);
      setReportState("done");
    } catch (cause) {
      setReportError(
        cause instanceof Error ? cause.message : "That arrival could not be sent. Try again."
      );
      setReportState("idle");
    }
  };

  return (
    <View style={{ ...CARD.surface, padding: 16, marginBottom: 14 }}>
      <View className="flex-row items-center gap-2">
        <View className="items-center justify-center rounded-full w-9 h-9 bg-safeplus-lightBlue">
          <Ionicons name="business-outline" size={18} color="#1570EF" />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-extrabold text-safeplus-navy">
            {assignments.length > 1 ? "Shelters assigned to your group" : "Shelter assigned to your group"}
          </Text>
          <Text className="text-[12.5px] text-safeplus-muted mt-0.5 leading-[17px]">
            The district has reserved these beds for the people you brought to
            safety. Drive them there, then report you have arrived — the shelter
            manager confirms the headcount.
          </Text>
        </View>
      </View>

      <View className="gap-2.5 mt-4">
        {assignments.map((shelter) => (
          <ShelterLine key={shelter.shelterId} shelter={shelter} onNavigate={onNavigate} />
        ))}
      </View>

      {heading ? (
        <View
          className="mt-4 flex-row items-center gap-2 px-3.5 py-2.5 rounded-xl"
          style={{ backgroundColor: "#ECFDF3", borderWidth: 1, borderColor: "#ABF2C4" }}
        >
          <Ionicons name="car-outline" size={16} color="#16A34A" />
          <Text style={{ color: "#14532D", fontSize: 12.5, fontWeight: "800" }}>
            Accepted — you are heading to the shelter.
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={() => void accept()}
          disabled={busy || ackState === "sending"}
          accessibilityRole="button"
          className="mt-4 flex-row items-center justify-center gap-2 h-12 rounded-2xl active:opacity-90"
          style={{ backgroundColor: "#16A34A" }}
        >
          {ackState === "sending" ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
          )}
          <Text className="text-[14px] font-extrabold text-white">
            {ackState === "sending" ? "Accepting…" : "Accept, heading to shelter"}
          </Text>
        </Pressable>
      )}

      {ackError ? (
        <Text className="text-[12.5px] font-semibold text-safeplus-red mt-2">{ackError}</Text>
      ) : null}

      {!heading &&
        (declining ? (
          <View className="mt-3 gap-2">
            <Text className="text-[12.5px] font-semibold text-safeplus-muted leading-[17px]">
              These beds don&apos;t work for your group? Declining frees the reservation
              and asks the district to reassign others.
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => void decline()}
                disabled={busy || rejectState === "sending"}
                accessibilityRole="button"
                className="flex-1 h-11 rounded-xl flex-row items-center justify-center gap-2 active:opacity-90"
                style={{ backgroundColor: "#F04438" }}
              >
                {rejectState === "sending" ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />
                )}
                <Text className="text-[13px] font-extrabold text-white">
                  {rejectState === "sending" ? "Declining…" : "Confirm decline"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDeclining(false)}
                accessibilityRole="button"
                className="flex-1 h-11 rounded-xl items-center justify-center"
                style={{ backgroundColor: "#EEF2F7" }}
              >
                <Text className="text-[13px] font-extrabold text-safeplus-navy">Keep the beds</Text>
              </Pressable>
            </View>
            {rejectError ? (
              <Text className="text-[12.5px] font-semibold text-safeplus-red">{rejectError}</Text>
            ) : null}
          </View>
        ) : (
          <Pressable
            onPress={() => setDeclining(true)}
            accessibilityRole="button"
            className="mt-2.5 self-center py-1.5"
          >
            <Text className="text-[12.5px] font-bold text-safeplus-red underline">
              These beds don&apos;t work — ask for others
            </Text>
          </Pressable>
        ))}

      {reportState === "done" && reportMessage ? (
        <View className="mt-3 px-3.5 py-2.5 rounded-xl bg-safeplus-paleGreen border border-safeplus-lightGreen">
          <Text className="text-[12.5px] font-semibold text-safeplus-darkGreen">{reportMessage}</Text>
        </View>
      ) : (
        <Pressable
          onPress={() => void report()}
          disabled={busy || reportState === "sending"}
          accessibilityRole="button"
          className="mt-3 flex-row items-center justify-center gap-2 h-12 rounded-2xl active:opacity-90"
          style={{ backgroundColor: INK, opacity: reportState === "sending" ? 0.7 : 1 }}
        >
          {reportState === "sending" ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="location-outline" size={18} color="#FFFFFF" />
          )}
          <Text className="text-[14px] font-extrabold text-white">
            {reportState === "sending" ? "Reporting…" : "Report arrival at shelter"}
          </Text>
        </Pressable>
      )}

      {reportError ? (
        <Text className="text-[12.5px] font-semibold text-safeplus-red mt-2">{reportError}</Text>
      ) : null}
    </View>
  );
}

function ShelterLine({
  shelter,
  onNavigate,
}: {
  shelter: ShelterAssignment;
  onNavigate: (destination: { lat: number; lng: number }) => void;
}) {
  const hasCoords = typeof shelter.latitude === "number" && typeof shelter.longitude === "number";

  return (
    <View
      className="flex-row items-center gap-3 p-3 rounded-2xl"
      style={{ backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E4E9F2" }}
    >
      <View className="flex-1">
        <Text style={{ color: INK, fontSize: 14, fontWeight: "900" }}>{shelter.name}</Text>
        <Text style={{ color: "#5B6B7F", fontSize: 12, fontWeight: "700", marginTop: 1 }}>
          {shelter.allocatedCount} {shelter.allocatedCount === 1 ? "place" : "places"} reserved
        </Text>
      </View>
      {hasCoords ? (
        <Pressable
          onPress={() => onNavigate({ lat: shelter.latitude as number, lng: shelter.longitude as number })}
          accessibilityRole="button"
          className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-xl active:opacity-80"
          style={{ backgroundColor: INK }}
        >
          <Ionicons name="navigate-outline" size={15} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>Navigate</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AwaitingShelterCard({ declined = false }: { declined?: boolean }) {
  return (
    <View style={{ ...CARD.surface, padding: 16, marginBottom: 14 }}>
      <View className="flex-row items-center gap-2">
        <View
          className="items-center justify-center rounded-full w-9 h-9"
          style={{ backgroundColor: "#FEF0C7" }}
        >
          <Ionicons
            name={declined ? "repeat-outline" : "hourglass-outline"}
            size={18}
            color="#B54708"
          />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-extrabold text-safeplus-navy">
            {declined ? "Waiting for new beds" : "Waiting for a shelter"}
          </Text>
          <Text className="text-[12.5px] text-safeplus-muted mt-0.5 leading-[17px]">
            {declined
              ? "You declined those beds. The district has been asked to reassign others — the new shelter will show here and on the map."
              : "The rescue is done. The district is matching your group to an open shelter — as soon as one is assigned it will show here and on the map."}
          </Text>
        </View>
      </View>
    </View>
  );
}

function StandbyCard({ teamName }: { teamName: string }) {
  return (
    <View className="px-4">
      <View style={{ ...CARD.surface, alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 }}>
        <View
          className="items-center justify-center"
          style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: "#ECFDF3", marginBottom: 16 }}
        >
          <Ionicons name="radio-outline" size={34} color="#16A34A" />
        </View>
        <Text style={{ color: INK, fontSize: 19, fontWeight: "900" }}>
          {teamName} is standing by
        </Text>
        <Text style={{ color: "#5B6B7F", fontSize: 13.5, textAlign: "center", marginTop: 8, lineHeight: 20 }}>
          No mission right now. When the district tasks your team you will get a
          notification on this phone — keep it on and the sound up.
        </Text>
      </View>
    </View>
  );
}
