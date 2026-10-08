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
import {
  AlertApiError,
  fetchMyReports,
  type HazardReportView,
  type ReportStatus,
} from "../services/dushani-alertApi";

const STATUS_COPY: Record<ReportStatus, { label: string; tone: "active" | "pending" }> = {
  PENDING_VERIFICATION: { label: "Awaiting check", tone: "pending" },
  VERIFIED: { label: "Verified", tone: "active" },
  REJECTED: { label: "Not verified", tone: "pending" },
  RESOLVED: { label: "Resolved", tone: "active" },
};

const humanize = (value: string) =>
  value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

interface MyReportsScreenProps {
  token: string;
  onBack: () => void;
  onNewReport: () => void;
}

export default function MyReportsScreen({
  token,
  onBack,
  onNewReport,
}: MyReportsScreenProps) {
  const [reports, setReports] = useState<HazardReportView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyReports(token)
      .then((items) => {
        setReports(items);
        setError(null);
      })
      .catch((loadError) =>
        setError(
          loadError instanceof AlertApiError
            ? loadError.message
            : "Your reports could not load."
        )
      )
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <FormScreenShell
      title="My reports"
      subtitle="What you have told SafePlus and what the officers decided."
      badge={loading ? "Loading" : `${reports.length} sent`}
      onBack={onBack}
    >
      {error && <RequestError message={error} />}

      {!loading && !error && reports.length === 0 && (
        <FormSection>
          <Notice
            tone="info"
            title="No reports yet"
            body="When you report a hazard, the verification decision and any warning raised from it appear here."
          />
        </FormSection>
      )}

      {reports.map((report) => {
        const status = STATUS_COPY[report.status] ?? {
          label: humanize(report.status),
          tone: "pending" as const,
        };

        return (
          <View key={report.id} className="mb-4">
            <FormSection>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-3">
                  <Text className="text-base font-extrabold text-safeplus-navy">
                    {humanize(report.hazardType)} · {report.locationDistrict}
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

              {report.verificationNotes && (
                <Text className="mt-3 p-3 rounded-xl bg-safeplus-fieldBg text-xs leading-5 text-safeplus-slate">
                  Officer note: {report.verificationNotes}
                </Text>
              )}

              {(report.warningCount ?? 0) > 0 && (
                <View className="flex-row items-center mt-3">
                  <Ionicons name="megaphone-outline" size={15} color="#D92D20" className="mr-1.5" />
                  <Text className="text-xs font-bold text-safeplus-red">
                    {report.warningCount} warning
                    {report.warningCount === 1 ? "" : "s"} broadcast from this report
                  </Text>
                </View>
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
