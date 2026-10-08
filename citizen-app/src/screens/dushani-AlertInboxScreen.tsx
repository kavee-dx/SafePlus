import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
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

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const day = (iso: string) =>
  new Date(iso).toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const humanize = (value: string) =>
  value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

interface AlertInboxScreenProps {
  token: string;
  onBack: () => void;
}

/**
 * What a broadcast looks like from the citizen's side: the emergency text the
 * warning service delivered to this number, laid out as the storyboard prints
 * it on the handset.
 */
export default function AlertInboxScreen({
  token,
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

      {!loading && !error && alerts.length === 0 && (
        <Notice
          tone="info"
          title="No alerts received"
          body="When a DMC officer broadcasts a warning for your district, it arrives here as an emergency text."
        />
      )}

      {alerts.map((alert) => {
        const isOpen = openId === alert.id;
        const isLive = alert.warningStatus === "ACTIVE";

        return (
          <View key={alert.id} className="mb-6">
            <Text className="mb-2 text-center text-[11px] font-bold text-safeplus-slate">
              {clock(alert.deliveredAt)} · {day(alert.deliveredAt)}
            </Text>

            <Pressable
              onPress={() => toggleAlert(alert)}
              accessibilityRole="button"
              accessibilityLabel={
                isOpen ? "Hide the full message" : "Show the full message"
              }
              className={`rounded-2xl overflow-hidden border bg-safeplus-surface ${
                alert.readAt ? "border-safeplus-hairline" : "border-safeplus-red"
              }`}
            >
              <View className="flex-row items-center justify-center px-4 py-3 bg-safeplus-red">
                <Ionicons name="warning" size={17} color="#FFFFFF" className="mr-2" />
                <Text className="text-[15px] font-extrabold uppercase tracking-[1px] text-white">
                  Emergency alert
                </Text>
              </View>

              <View className="px-4 py-4">
                <Text className="text-base font-extrabold text-safeplus-navy">
                  {alert.levelLabel}
                </Text>
                <Text className="mt-1.5 text-[15px] font-bold text-safeplus-navySoft">
                  {alert.areaLabel}
                </Text>
                <Text className="mt-1.5 text-sm leading-6 text-safeplus-navy">
                  {alert.instruction}
                </Text>

                {isOpen && (
                  <Text className="mt-3 p-3 rounded-xl bg-safeplus-fieldBg text-xs leading-5 text-safeplus-slate">
                    {alert.body}
                  </Text>
                )}

                <View className="flex-row items-center mt-3">
                  <View
                    className={`w-2 h-2 rounded-full mr-2 ${
                      isLive ? "bg-safeplus-red" : "bg-safeplus-slate"
                    }`}
                  />
                  <Text className="text-[11px] font-bold text-safeplus-slate uppercase">
                    {isLive
                      ? `${humanize(alert.hazardType)} · still active`
                      : `Alert ${alert.warningStatus.toLowerCase().replace(/_/g, " ")}`}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center justify-center px-4 py-3 bg-safeplus-red">
                <Text className="text-sm font-extrabold uppercase tracking-[1px] text-white">
                  Stay safe
                </Text>
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={15}
                  color="#FFFFFF"
                  className="ml-2"
                />
              </View>
            </Pressable>

            <Text className="mt-1.5 text-center text-[11px] text-safeplus-slate">
              SMS · {alert.senderId} · {alert.warningId}
            </Text>
          </View>
        );
      })}

      {alerts.length > 0 && (
        <Pressable
          onPress={() => {
            setLoading(true);
            setReloadToken((current) => current + 1);
          }}
          accessibilityRole="button"
          className="flex-row items-center justify-center h-12 mb-2 rounded-xl border border-safeplus-hairline bg-safeplus-surface active:opacity-85"
        >
          <Ionicons name="refresh" size={17} color="#0F172A" className="mr-2" />
          <Text className="text-sm font-bold text-safeplus-navy">Check again</Text>
        </Pressable>
      )}
    </FormScreenShell>
  );
}
