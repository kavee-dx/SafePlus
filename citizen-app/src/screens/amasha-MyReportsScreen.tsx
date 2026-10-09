import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  FormScreenShell,
  FormSection,
  Notice,
  RequestError,
  StatusPill,
} from "../components/dushani-RegistrationUI";
import { AlertApiError } from "../services/dushani-alertApi";
import {
  fetchMyReportNotifications,
  fetchMyReportsExtended,
  markMyNotificationRead,
  type ExtendedReport,
  type ExtendedReportStatus,
  type ReportNotification,
} from "../services/amasha-reportApi";
import {
  listOfflineReports,
  syncOfflineReports,
  type OfflineDraft,
} from "../services/amasha-offlineReports";
import { labelFor, HAZARDS } from "../utils/amasha-reportForm";

const STATUS_COPY: Record<
  ExtendedReportStatus,
  { label: string; tone: "active" | "pending" }
> = {
  PENDING_VERIFICATION: { label: "Pending Verification", tone: "pending" },
  ADDITIONAL_INFO_REQUIRED: { label: "More information required", tone: "pending" },
  VERIFIED: { label: "Verified", tone: "active" },
  REJECTED: { label: "Rejected", tone: "pending" },
  RESOLVED: { label: "Resolved", tone: "active" },
};

interface MyReportsScreenProps {
  token: string;
  userKey: string;
  onBack: () => void;
  onNewReport: () => void;
  onUpdateReport: (id: string) => void;
}

export default function MyReportsScreen({
  token,
  userKey,
  onBack,
  onNewReport,
  onUpdateReport,
}: MyReportsScreenProps) {
  const [reports, setReports] = useState<ExtendedReport[]>([]);
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [notes, setNotes] = useState<ReportNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [items, offline, inbox] = await Promise.all([
        fetchMyReportsExtended(token),
        listOfflineReports(userKey),
        fetchMyReportNotifications(token).catch(() => ({
          notifications: [] as ReportNotification[],
          unreadCount: 0,
        })),
      ]);

      setReports(items);
      setDrafts(offline);
      setNotes(
        inbox.notifications.filter((item) =>
          [
            "REPORT_INFO_REQUESTED",
            "REPORT_VERIFIED",
            "REPORT_REJECTED",
          ].includes(item.type)
        )
      );
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof AlertApiError
          ? loadError.message
          : "Your reports could not load."
      );
      setDrafts(await listOfflineReports(userKey));
    } finally {
      setLoading(false);
    }
  }, [token, userKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncNow() {
    setSyncing(true);
    setSyncMessage(null);

    const result = await syncOfflineReports(token, userKey);
    setDrafts(await listOfflineReports(userKey));

    if (result.sent > 0) {
      setSyncMessage(
        `${result.sent} saved report${result.sent === 1 ? "" : "s"} sent. DMC has been notified.`
      );
      await load();
    } else if (result.lastError) {
      setSyncMessage(result.lastError);
    } else if (result.remaining === 0) {
      setSyncMessage("Nothing waiting to send.");
    }

    setSyncing(false);
  }

  async function dismissNote(note: ReportNotification) {
    if (!note.isRead) {
      await markMyNotificationRead(token, note.id).catch(() => undefined);
    }

    setNotes((current) => current.filter((item) => item.id !== note.id));
  }

  return (
    <FormScreenShell
      title="My reports"
      subtitle="What you have told SafePlus, including offline drafts and officer decisions."
      badge={loading ? "Loading" : `${reports.length + drafts.length} total`}
      onBack={onBack}
    >
      {error && <RequestError message={error} />}
      {syncMessage && (
        <Notice tone="info" title="Synchronization" body={syncMessage} />
      )}

      {notes.slice(0, 3).map((note) => (
        <Pressable
          key={note.id}
          onPress={() => void dismissNote(note)}
          className="mb-4"
        >
          <Notice
            tone={note.type === "REPORT_VERIFIED" ? "success" : "pending"}
            title={note.title}
            body={note.message}
          />
        </Pressable>
      ))}

      {drafts.length > 0 && (
        <FormSection
          title="Pending Synchronization"
          caption="Saved securely on this device because the network was unavailable."
          icon="cloud-offline-outline"
        >
          {drafts.map((draft) => (
            <View key={draft.id} className="mb-3">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-3">
                  <Text className="text-sm font-extrabold text-safeplus-navy">
                    {labelFor(HAZARDS, draft.payload.hazardType)} ·{" "}
                    {draft.payload.locationDistrict}
                  </Text>
                  <Text className="mt-1 text-xs text-safeplus-slate">
                    Saved {new Date(draft.savedAt).toLocaleString()} · {draft.id}
                  </Text>
                </View>
                <StatusPill tone="pending" label="Pending Synchronization" />
              </View>
            </View>
          ))}
          <Pressable
            onPress={() => void syncNow()}
            disabled={syncing}
            className="flex-row items-center justify-center h-12 mt-2 rounded-xl bg-safeplus-navy"
          >
            <Text className="text-sm font-extrabold text-white">
              {syncing ? "Sending…" : "Send saved reports now"}
            </Text>
          </Pressable>
        </FormSection>
      )}

      {!loading && !error && reports.length === 0 && drafts.length === 0 && (
        <FormSection>
          <Notice
            tone="info"
            title="No reports yet"
            body="When you report an incident, the verification decision and any request for more information appear here."
          />
        </FormSection>
      )}

      {reports.map((report) => {
        const status = STATUS_COPY[report.status] ?? {
          label: report.status,
          tone: "pending" as const,
        };

        return (
          <View key={report.id} className="mb-4">
            <FormSection>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-3">
                  <Text className="text-base font-extrabold text-safeplus-navy">
                    {labelFor(HAZARDS, report.hazardType)} · {report.locationDistrict}
                  </Text>
                  <Text className="mt-1 text-xs text-safeplus-slate">
                    {new Date(report.createdAt).toLocaleString()} · {report.reportId}
                  </Text>
                </View>
                <StatusPill tone={status.tone} label={status.label} />
              </View>

              <Text className="mt-3 text-sm leading-6 text-safeplus-navy">
                {report.description}
              </Text>

              {report.status === "ADDITIONAL_INFO_REQUIRED" && report.infoRequestReason && (
                <Text className="mt-3 p-3 rounded-xl bg-safeplus-amberSoft text-xs leading-5 text-safeplus-navy">
                  Officer needs: {report.infoRequestReason}
                </Text>
              )}

              {report.verificationNotes && report.status !== "ADDITIONAL_INFO_REQUIRED" && (
                <Text className="mt-3 p-3 rounded-xl bg-safeplus-fieldBg text-xs leading-5 text-safeplus-slate">
                  Officer note: {report.verificationNotes}
                  {report.verifiedByName ? ` — ${report.verifiedByName}` : ""}
                </Text>
              )}

              {(report.warningCount ?? 0) > 0 && (
                <View className="flex-row items-center mt-3">
                  <Ionicons
                    name="megaphone-outline"
                    size={15}
                    color="#D92D20"
                    className="mr-1.5"
                  />
                  <Text className="text-xs font-bold text-safeplus-red">
                    {report.warningCount} warning
                    {report.warningCount === 1 ? "" : "s"} broadcast from this report
                  </Text>
                </View>
              )}

              {report.status === "ADDITIONAL_INFO_REQUIRED" && (
                <Pressable
                  onPress={() => onUpdateReport(report.id)}
                  className="flex-row items-center justify-center h-12 mt-4 rounded-xl bg-safeplus-blue"
                >
                  <Text className="text-sm font-extrabold text-white">
                    Update and resubmit
                  </Text>
                </Pressable>
              )}
            </FormSection>
          </View>
        );
      })}

      <Pressable
        onPress={onNewReport}
        accessibilityRole="button"
        className="flex-row items-center justify-center h-14 mb-2 rounded-xl bg-safeplus-blue active:opacity-85"
      >
        <Ionicons name="add" size={20} color="#FFFFFF" className="mr-2" />
        <Text className="text-base font-extrabold text-white">Report another incident</Text>
      </Pressable>
    </FormScreenShell>
  );
}
