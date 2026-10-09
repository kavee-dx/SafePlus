import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  FormScreenShell,
  Notice,
  RequestError,
} from "../components/dushani-RegistrationUI";
import {
  AlertApiError,
  fetchAlertInbox,
  markAlertRead,
  type DeliveredAlert,
} from "../services/dushani-alertApi";

const stamp = (iso: string) =>
  new Date(iso).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const humanize = (value: string) =>
  value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Counts and timestamps must line up in columns, so digits stay fixed width. */
const tabular: TextStyle = { fontVariant: ["tabular-nums"] };

const mono: TextStyle = {
  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  fontVariant: ["tabular-nums"],
};

const ALERT_LANGUAGES = [
  { label: "English", field: "englishMessage" },
  { label: "Sinhala", field: "sinhalaMessage" },
  { label: "Tamil", field: "tamilMessage" },
] as const;

interface AlertInboxScreenProps {
  token: string;
  pushState: "unknown" | "ready" | "blocked" | "unsupported";
  pushReason?: string | null;
  onBack: () => void;
}

function PointLabel({ children }: { children: string }) {
  return (
    <Text className="text-[10px] font-extrabold uppercase tracking-[1px] text-safeplus-slate">
      {children}
    </Text>
  );
}

/** One fact per row: tiny label on the left, value free to wrap on the right. */
function DetailRow({
  label,
  value,
  sub,
  identifier,
  divider = true,
}: {
  label: string;
  value: string;
  sub?: string;
  identifier?: boolean;
  divider?: boolean;
}) {
  return (
    <View
      className={`py-2.5 ${
        divider ? "border-b border-safeplus-hairline" : ""
      }`}
    >
      <View className="flex-row items-start">
        <View className="w-[96px] mr-2">
          <PointLabel>{label}</PointLabel>
        </View>
        <Text
          style={identifier ? mono : undefined}
          className="flex-1 text-[13px] font-bold text-safeplus-navy"
        >
          {value}
        </Text>
      </View>

      {sub && (
        <Text
          style={tabular}
          className="mt-1 ml-[104px] text-[10px] font-bold uppercase tracking-[0.6px] text-safeplus-slate"
        >
          {sub}
        </Text>
      )}
    </View>
  );
}

/** A live warning breathes; a stood-down one must never look like it can. */
function LiveStatusDot() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });

  return (
    <View className="items-center justify-center w-3.5 h-3.5 mr-2">
      <View className="absolute w-3.5 h-3.5 rounded-full bg-safeplus-red/25" />
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <View className="w-2 h-2 rounded-full bg-safeplus-red" />
      </Animated.View>
    </View>
  );
}

function MutedStatusDot() {
  return (
    <View className="items-center justify-center w-3.5 h-3.5 mr-2">
      <View className="w-2 h-2 rounded-full bg-safeplus-slate/50" />
    </View>
  );
}

/** One delivered broadcast, laid out the way the storyboard prints it. */
function AlertCard({
  alert,
  isOpen,
  onToggle,
}: {
  alert: DeliveredAlert;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const isLive = alert.warningStatus === "ACTIVE";
  const isUnread = !alert.readAt;
  const [sheltersOpen, setSheltersOpen] = useState(false);

  const band = isLive ? "bg-safeplus-red" : "bg-safeplus-navySoft";
  const chip = isLive
    ? "bg-white/15 border border-white/25"
    : "bg-white/10 border border-white/20";

  const messages = ALERT_LANGUAGES.map((entry) => ({
    label: entry.label,
    text: alert[entry.field]?.trim() ?? "",
  })).filter((entry) => entry.text.length > 0);

  return (
    <View className="mb-5">
      <View
        className={`rounded-2xl overflow-hidden border ${
          isLive
            ? "border-safeplus-red/30 shadow-lg"
            : "border-safeplus-hairline shadow-sm"
        }`}
      >
        <View className={`flex-row items-center px-4 py-3 ${band}`}>
          <View
            className={`items-center justify-center w-9 h-9 mr-3 rounded-xl ${chip}`}
          >
            <Ionicons name="megaphone" size={18} color="#FFFFFF" />
          </View>

          <View className="flex-1">
            <Text className="text-[15px] font-extrabold uppercase tracking-[1.1px] text-white">
              Emergency alert
            </Text>
            <Text className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.8px] text-white/75">
              DMC national warning service
            </Text>
          </View>

          {isUnread && (
            <View className="ml-2 px-2 py-1 rounded-full bg-white/20 border border-white/40">
              <Text className="text-[9px] font-extrabold uppercase tracking-[1px] text-white">
                New
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row">
          <View
            className={`w-1.5 ${
              isUnread ? "bg-safeplus-red" : "bg-safeplus-hairline"
            }`}
          />

          <View
            className={`flex-1 px-4 py-4 ${
              isUnread ? "bg-safeplus-surface" : "bg-safeplus-canvas/70"
            }`}
          >
            <Text className="text-[17px] font-extrabold leading-6 text-safeplus-navy">
              {alert.levelLabel}
            </Text>

            <View className="flex-row items-start mt-2">
              <Ionicons
                name="location"
                size={14}
                color={isLive ? "#D92D20" : "#64748B"}
                className="mr-1.5 mt-0.5"
              />
              <Text
                className={`flex-1 text-[13px] font-bold uppercase tracking-[0.5px] ${
                  isLive ? "text-safeplus-navySoft" : "text-safeplus-slate"
                }`}
              >
                {alert.areaLabel}
              </Text>
            </View>

            <View
              className={`mt-3 p-3.5 rounded-r-xl border-l-2 ${
                isLive
                  ? "bg-safeplus-lightRed border-l-safeplus-red"
                  : "bg-safeplus-fieldBg border-l-safeplus-navySoft"
              }`}
            >
              <PointLabel>What to do</PointLabel>
              <Text
                className={`mt-1 flex-1 text-[14px] font-extrabold leading-5 ${
                  isLive ? "text-safeplus-navy" : "text-safeplus-slate"
                }`}
              >
                {alert.instruction}
              </Text>
            </View>

            <View className="flex-row items-start mt-3 pt-3 border-t border-safeplus-hairline">
              <View className="flex-1">
                <PointLabel>Posted</PointLabel>
                <Text
                  style={tabular}
                  className={`mt-1 text-[12.5px] font-bold ${
                    isLive ? "text-safeplus-navy" : "text-safeplus-slate"
                  }`}
                >
                  {stamp(alert.deliveredAt)}
                </Text>
              </View>

              <View className="w-px self-stretch mx-3 bg-safeplus-hairline" />

              <View className="flex-1">
                <PointLabel>{isLive ? "Active until" : "Expired"}</PointLabel>
                <Text
                  style={tabular}
                  className="mt-1 text-[12.5px] font-bold text-safeplus-navy"
                >
                  {alert.expiresAt ? stamp(alert.expiresAt) : "No end time set"}
                </Text>
              </View>
            </View>

            {isOpen && (
              <View className="mt-3 pt-3 border-t border-safeplus-hairline">
                {messages.map((message) => (
                  <View key={message.label} className="mb-2.5">
                    <PointLabel>{message.label}</PointLabel>
                    <Text className="mt-1 flex-1 p-3 rounded-xl border border-safeplus-hairline bg-safeplus-fieldBg text-[13px] leading-5 text-safeplus-navy">
                      {message.text}
                    </Text>
                  </View>
                ))}

                {messages.length === 0 && (
                  <View>
                    <PointLabel>Message</PointLabel>
                    <Text className="mt-1 flex-1 p-3 rounded-xl border border-safeplus-hairline bg-safeplus-fieldBg text-[13px] leading-5 text-safeplus-slate">
                      {alert.body}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <Pressable
              onPress={() => setSheltersOpen((current) => !current)}
              accessibilityRole="button"
              accessibilityState={{ expanded: sheltersOpen }}
              className={`flex-row items-center justify-center h-11 mt-3 rounded-xl border active:opacity-85 ${
                sheltersOpen
                  ? "bg-safeplus-navy border-safeplus-navy"
                  : "bg-safeplus-white border-safeplus-navyLine"
              }`}
            >
              <Ionicons
                name="business-outline"
                size={16}
                color={sheltersOpen ? "#FFFFFF" : "#0F172A"}
                className="mr-2"
              />
              <Text
                className={`text-[12px] font-extrabold uppercase tracking-[0.7px] ${
                  sheltersOpen ? "text-white" : "text-safeplus-navy"
                }`}
              >
                View designated shelters
              </Text>
              <Ionicons
                name={sheltersOpen ? "chevron-up" : "chevron-down"}
                size={14}
                color={sheltersOpen ? "#FFFFFF" : "#0F172A"}
                className="ml-2"
              />
            </Pressable>

            {sheltersOpen && (
              <View className="mt-2.5 p-3 rounded-xl border border-safeplus-hairline bg-safeplus-white">
                <View className="flex-row items-center justify-between">
                  <PointLabel>Designated shelters</PointLabel>
                  <Text className="text-[10px] font-bold uppercase tracking-[0.5px] text-safeplus-slate">
                    {alert.targetDistrict} District
                  </Text>
                </View>

                <Text className="mt-1.5 text-xs leading-5 text-safeplus-slate">
                  No shelter names were published with this warning. When the DMC
                  issues an evacuation order, the shelter list appears here.
                </Text>
              </View>
            )}

            <View className="flex-row items-center mt-3 pt-3 border-t border-safeplus-hairline">
              {isLive ? <LiveStatusDot /> : <MutedStatusDot />}

              <Text
                className={`flex-1 text-[11px] font-extrabold uppercase tracking-[0.8px] ${
                  isLive ? "text-safeplus-red" : "text-safeplus-slate"
                }`}
              >
                {isLive ? "Still active" : humanize(alert.warningStatus)}
              </Text>

              <View className="ml-2 px-2 py-1 rounded-full border border-safeplus-hairline bg-safeplus-white">
                <Text className="text-[10px] font-bold uppercase tracking-[0.5px] text-safeplus-slate">
                  {humanize(alert.hazardType)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          accessibilityLabel={
            isOpen ? "Hide the full message" : "Show the full message"
          }
          className={`flex-row items-center px-4 py-3 ${band} active:opacity-90`}
        >
          <Text className="flex-1 text-[11px] font-extrabold uppercase tracking-[1.4px] text-white">
            Stay safe
          </Text>
          <Text className="text-[10px] font-bold uppercase tracking-[0.6px] text-white/80">
            {isOpen ? "Shorter view" : "Read all languages"}
          </Text>
          <Ionicons
            name={isOpen ? "chevron-up" : "chevron-down"}
            size={15}
            color="#FFFFFF"
            className="ml-2"
          />
        </Pressable>
      </View>

      <View className="flex-row items-center justify-center mt-2">
        <Text
          style={mono}
          className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-safeplus-slate"
        >
          {alert.warningId}
        </Text>
        <View className="w-1 h-1 mx-2.5 rounded-full bg-safeplus-border" />
        <Text className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-safeplus-slate">
          Sender {alert.senderId}
        </Text>
      </View>
    </View>
  );
}

/** Placeholder cards so an inbox that is still checking reads as a list. */
function InboxSkeleton() {
  return (
    <View>
      {[0, 1].map((slot) => (
        <View
          key={slot}
          className="mb-5 rounded-2xl overflow-hidden border border-safeplus-hairline bg-safeplus-surface shadow-sm"
        >
          <View className="flex-row items-center px-4 py-3 bg-safeplus-navy/10">
            <View className="w-9 h-9 mr-3 rounded-xl bg-safeplus-hairline" />
            <View className="flex-1">
              <View className="w-2/3 h-3 rounded bg-safeplus-hairline" />
              <View className="w-1/3 h-2 mt-2 rounded bg-safeplus-hairline" />
            </View>
          </View>

          <View className="flex-row">
            <View className="w-1.5 bg-safeplus-hairline" />
            <View className="flex-1 px-4 py-4">
              <View className="w-3/4 h-4 rounded bg-safeplus-hairline" />
              <View className="w-1/2 h-3 mt-3 rounded bg-safeplus-hairline" />
              <View className="mt-4 p-3.5 rounded-r-xl bg-safeplus-fieldBg">
                <View className="w-16 h-2 rounded bg-safeplus-hairline" />
                <View className="w-full h-3 mt-2.5 rounded bg-safeplus-hairline" />
                <View className="w-2/3 h-3 mt-2 rounded bg-safeplus-hairline" />
              </View>
              <View className="flex-row mt-4">
                <View className="flex-1 h-3 rounded bg-safeplus-hairline" />
                <View className="flex-1 ml-3 h-3 rounded bg-safeplus-hairline" />
              </View>
              <View className="h-11 mt-3 rounded-xl bg-safeplus-fieldBg" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * What a broadcast looks like from the citizen's side: the emergency text the
 * warning service delivered to this number, laid out as the storyboard prints
 * it on the handset.
 */
export default function AlertInboxScreen({
  token,
  pushState,
  pushReason,
  onBack,
}: AlertInboxScreenProps) {
  const [alerts, setAlerts] = useState<DeliveredAlert[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    fetchAlertInbox(token)
      .then(({ alerts: items }) => {
        setAlerts(items);
        setError(null);
      })
      .catch((loadError) =>
        setError(
          loadError instanceof AlertApiError
            ? loadError.message
            : "Your alerts could not load."
        )
      )
      .finally(() => setLoading(false));
  }, [token, reloadToken]);

  const unreadCount = alerts.filter((alert) => !alert.readAt).length;

  function toggleAlert(alert: DeliveredAlert) {
    if (openId === alert.id) {
      setOpenId(null);
      return;
    }

    setOpenId(alert.id);

    if (alert.readAt) {
      return;
    }

    markAlertRead(token, alert.id)
      .then(() =>
        setAlerts((current) =>
          current.map((item) =>
            item.id === alert.id
              ? { ...item, readAt: new Date().toISOString() }
              : item
          )
        )
      )
      .catch(() => undefined);
  }

  return (
    <FormScreenShell
      title="DMC alerts"
      subtitle="Emergency warnings delivered to this phone."
      badge={loading ? "Checking" : unreadCount > 0 ? `${unreadCount} new` : "Read"}
      onBack={onBack}
    >
      {error && <RequestError message={error} />}

      {pushState === "blocked" && (
        <View className="mb-4">
          <Notice
            tone="pending"
            title="Push is off for this phone"
            body={
              pushReason ??
              "This phone could not register for remote push."
            }
          />

          <View className="mt-2 px-3.5 py-1 rounded-2xl border border-safeplus-hairline bg-safeplus-surface">
            <DetailRow
              label="Inbox"
              value="Alerts still arrive here within about twenty seconds of a broadcast."
            />
            <DetailRow
              label="Sound"
              value="The phone will not buzz until it is opened or the block is cleared in settings."
              divider={false}
            />
          </View>
        </View>
      )}

      {pushState === "unsupported" && (
        <View className="mb-4">
          <Notice
            tone="pending"
            title="Push needs a real handset"
            body="An emulator or web preview cannot register for the push service."
          />

          <View className="mt-2 px-3.5 py-1 rounded-2xl border border-safeplus-hairline bg-safeplus-surface">
            <DetailRow
              label="Inbox"
              value="A broadcast still lands in this inbox."
            />
            <DetailRow
              label="Push"
              value="Only a physical device receives the alert notification."
              divider={false}
            />
          </View>
        </View>
      )}

      {!loading && alerts.length > 0 && (
        <View className="flex-row items-center mb-6 px-4 py-3 rounded-2xl bg-safeplus-navy shadow-md">
          <View className="items-center justify-center w-9 h-9 mr-3 rounded-xl bg-safeplus-navySoft border border-safeplus-navyLine">
            <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
          </View>

          <View className="flex-1">
            <Text className="text-[13px] font-extrabold text-white">
              {alerts.length} {alerts.length === 1 ? "warning" : "warnings"}{" "}
              delivered
            </Text>

            <View className="flex-row items-start mt-2">
              <View className="flex-1 mr-3">
                <Text className="text-[10px] font-extrabold uppercase tracking-[1px] text-safeplus-navyText">
                  Unread
                </Text>
                <Text
                  style={tabular}
                  className="mt-1 flex-1 text-[12.5px] font-bold text-white"
                >
                  {unreadCount} of {alerts.length}
                </Text>
              </View>

              <View className="flex-1">
                <Text className="text-[10px] font-extrabold uppercase tracking-[1px] text-safeplus-navyText">
                  To read
                </Text>
                <Text className="mt-1 flex-1 text-[12.5px] font-bold text-safeplus-navyText">
                  {unreadCount > 0
                    ? "Tap a card to expand it"
                    : "Every message read here"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {loading && <InboxSkeleton />}

      {!loading && !error && alerts.length === 0 && (
        <View className="mb-6 p-4 rounded-2xl border border-safeplus-hairline bg-safeplus-surface shadow-sm">
          <View className="items-center mb-4">
            <View className="items-center justify-center w-14 h-14 rounded-full bg-safeplus-blueSoft">
              <Ionicons
                name="notifications-off-outline"
                size={24}
                color="#1570EF"
              />
            </View>
            <Text className="mt-3 text-[11px] font-extrabold uppercase tracking-[1px] text-safeplus-slate">
              Inbox clear
            </Text>
          </View>

          <Notice
            tone="info"
            title="No alerts received"
            body="When a DMC officer broadcasts a warning for your district, it arrives here as an emergency text."
          />
        </View>
      )}

      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          isOpen={openId === alert.id}
          onToggle={() => toggleAlert(alert)}
        />
      ))}

      {alerts.length > 0 && (
        <Pressable
          onPress={() => {
            setLoading(true);
            setReloadToken((current) => current + 1);
          }}
          accessibilityRole="button"
          className="flex-row items-center justify-center h-12 mb-4 rounded-2xl border border-safeplus-hairline bg-safeplus-surface shadow-sm active:opacity-85"
        >
          <Ionicons name="refresh" size={17} color="#0F172A" className="mr-2" />
          <Text className="text-sm font-bold text-safeplus-navy">Check again</Text>
        </Pressable>
      )}
    </FormScreenShell>
  );
}
