import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const humanize = (value: string) =>
  value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

interface AlertsTabProps {
  token: string;
  /** Called after an alert is marked read so the unread count can refresh. */
  onAlertsChanged?: () => void;
}

export default function AlertsTab({ token, onAlertsChanged }: AlertsTabProps) {
  const [alerts, setAlerts] = useState<DeliveredAlert[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchAlertInbox(token)
      .then(({ alerts: items }) => {
        if (cancelled) return;
        setAlerts(items);
        setError(null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(
          loadError instanceof AlertApiError
            ? loadError.message
            : "Your alerts could not load."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, reloadToken]);

  const unreadCount = alerts.filter((alert) => !alert.readAt).length;

  function toggleAlert(alert: DeliveredAlert) {
    if (openId === alert.id) {
      setOpenId(null);
      return;
    }

    setOpenId(alert.id);

    if (alert.readAt) return;

    markAlertRead(token, alert.id)
      .then(() => {
        setAlerts((current) =>
          current.map((item) =>
            item.id === alert.id
              ? { ...item, readAt: new Date().toISOString() }
              : item
          )
        );
        onAlertsChanged?.();
      })
      .catch(() => undefined);
  }

  function reload() {
    setLoading(true);
    setReloadToken((current) => current + 1);
  }

  return (
    <View>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-5">
        <View className="flex-1 pr-3">
          <Text className="text-3xl font-extrabold text-safeplus-darkGreen">
            Alerts
          </Text>
          <Text className="mt-1 text-sm text-safeplus-muted">
            Warnings from the Disaster Management Centre.
          </Text>
        </View>
        <View
          className={`px-3 py-1.5 rounded-full ${
            unreadCount > 0 ? "bg-safeplus-red" : "bg-safeplus-paleGreen"
          }`}
        >
          <Text
            className={`text-xs font-extrabold ${
              unreadCount > 0 ? "text-white" : "text-safeplus-darkGreen"
            }`}
          >
            {loading ? "Checking" : unreadCount > 0 ? `${unreadCount} new` : "All read"}
          </Text>
        </View>
      </View>

      {/* Loading */}
      {loading && alerts.length === 0 && (
        <View className="items-center py-16">
          <ActivityIndicator size="large" color="#1B7F4B" />
        </View>
      )}

      {/* Error */}
      {error && (
        <View className="p-5 mb-4 border border-red-200 rounded-3xl bg-red-50">
          <Text className="text-base font-bold text-red-600">{error}</Text>
          <Pressable onPress={reload} className="mt-3 active:opacity-70">
            <Text className="text-sm font-extrabold text-red-600">Try again</Text>
          </Pressable>
        </View>
      )}

      {/* Empty state */}
      {!loading && !error && alerts.length === 0 && (
        <View className="items-center px-6 pt-10">
          <View className="items-center justify-center w-20 h-20 rounded-full bg-safeplus-paleGreen">
            <Ionicons name="notifications-outline" size={36} color="#1B7F4B" />
          </View>
          <Text className="mt-5 text-xl font-extrabold text-safeplus-darkGreen">
            No alerts yet
          </Text>
          <Text className="mt-2 text-base leading-6 text-center text-safeplus-muted">
            Disaster warnings and updates from the Disaster Management Centre
            will appear here.
          </Text>
        </View>
      )}

      {/* Alert list */}
      {alerts.map((alert) => {
        const isOpen = openId === alert.id;
        const isLive = alert.warningStatus === "ACTIVE";
        const isUnread = !alert.readAt;

        return (
          <Pressable
            key={alert.id}
            onPress={() => toggleAlert(alert)}
            accessibilityRole="button"
            accessibilityLabel={
              isOpen ? "Hide the full message" : "Show the full message"
            }
            className={`mb-3 overflow-hidden bg-white border rounded-3xl active:opacity-90 ${
              isUnread ? "border-safeplus-red" : "border-safeplus-border"
            }`}
          >
            <View
              className={`flex-row items-center px-4 py-2.5 ${
                isLive ? "bg-safeplus-red" : "bg-safeplus-slate"
              }`}
            >
              <Ionicons
                name="warning"
                size={15}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text className="flex-1 text-xs font-extrabold tracking-wide text-white uppercase">
                {isLive ? "Emergency alert" : `Alert ${humanize(alert.warningStatus).toLowerCase()}`}
              </Text>
              <Text className="text-[11px] font-semibold text-white/90">
                {clock(alert.deliveredAt)} · {day(alert.deliveredAt)}
              </Text>
            </View>

            <View className="px-4 py-4">
              <View className="flex-row items-center">
                {isUnread && (
                  <View className="w-2 h-2 mr-2 rounded-full bg-safeplus-red" />
                )}
                <Text className="flex-1 text-base font-extrabold text-safeplus-navy">
                  {alert.levelLabel}
                </Text>
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#6B7280"
                />
              </View>

              <Text className="mt-1 text-sm font-bold text-safeplus-navySoft">
                {alert.areaLabel}
              </Text>
              <Text className="mt-1.5 text-sm leading-5 text-safeplus-navy">
                {alert.instruction}
              </Text>

              {isOpen && (
                <Text className="p-3 mt-3 text-xs leading-5 rounded-xl bg-safeplus-fieldBg text-safeplus-slate">
                  {alert.body}
                </Text>
              )}

              <View className="flex-row items-center mt-3">
                <Text className="text-[11px] font-bold uppercase text-safeplus-slate">
                  {humanize(alert.hazardType)}
                  {isLive ? " · still active" : ""}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}

      {alerts.length > 0 && (
        <Pressable
          onPress={reload}
          accessibilityRole="button"
          className="flex-row items-center justify-center h-12 mt-1 bg-white border rounded-2xl border-safeplus-border active:opacity-80"
        >
          <Ionicons
            name="refresh"
            size={17}
            color="#0F172A"
            style={{ marginRight: 8 }}
          />
          <Text className="text-sm font-bold text-safeplus-navy">Check again</Text>
        </Pressable>
      )}
    </View>
  );
}