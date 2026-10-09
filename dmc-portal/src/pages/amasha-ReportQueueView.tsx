import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Inbox,
  Loader2,
  Megaphone,
  RefreshCw,
} from "lucide-react";

import {
  fetchQueueInfoRequired,
  fetchQueuePending,
  fetchQueueRejected,
  fetchQueueVerified,
  type ExtendedReport,
} from "../services/amasha-reportApi";
import { fetchDistricts } from "../services/dushani-alertApi";
import {
  SEVERITY_CLASS,
  STATUS_META,
  label,
  relativeTime,
  type QueueTab,
} from "./amasha-reportUi";

interface ReportQueueViewProps {
  onOpen: (report: ExtendedReport) => void;
  onIssueWarning: (reportId: string) => void;
}

const TAB_LABEL: Record<QueueTab, string> = {
  pending: "Awaiting verification",
  info: "Needs more info",
  verified: "Verified",
  rejected: "Rejected",
};

export default function ReportQueueView({
  onOpen,
  onIssueWarning,
}: ReportQueueViewProps) {
  const [tab, setTab] = useState<QueueTab>("pending");
  const [district, setDistrict] = useState("");
  const [districts, setDistricts] = useState<string[]>([]);
  const [data, setData] = useState<Record<QueueTab, ExtendedReport[]>>({
    pending: [],
    info: [],
    verified: [],
    rejected: [],
  });
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);

    Promise.all([
      fetchQueuePending(district || undefined),
      fetchQueueInfoRequired(district || undefined),
      fetchQueueVerified(),
      fetchQueueRejected(),
    ])
      .then(([pending, info, verified, rejected]) => {
        setData({ pending, info, verified, rejected });
        setError(null);
      })
      .catch((loadError) => {
        setError(messageOf(loadError));
        setData({ pending: [], info: [], verified: [], rejected: [] });
      })
      .finally(() => setLoading(false));
  }, [district]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  useEffect(() => {
    fetchDistricts()
      .then((items) => setDistricts(items.map((item) => item.district).sort()))
      .catch(() => setDistricts([]));
  }, []);

  const reports = data[tab];

  return (
    <div className="rc">
      <div className="rc-toolbar">
        <div className="rc-tabs">
          {(Object.keys(TAB_LABEL) as QueueTab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`rc-tab ${tab === key ? "rc-tab-active" : ""}`}
              onClick={() => setTab(key)}
            >
              {TAB_LABEL[key]}
              <span className="rc-tab-count">{data[key].length}</span>
            </button>
          ))}
        </div>

        <div className="rc-filters">
          {tab !== "verified" && tab !== "rejected" && (
            <select
              className="rc-select"
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
            >
              <option value="">All districts</option>
              {districts.map((name) => (
                <option key={name} value={name}>
                  {name} District
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="rc-refresh"
            onClick={() => setReloadToken((current) => current + 1)}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rc-banner rc-banner-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading && (
        <div className="sp-empty" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Loader2 className="rc-spin" size={18} /> Loading reports…
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="sp-empty" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Inbox size={20} />
          {tab === "pending"
            ? "No citizen reports are waiting for verification."
            : tab === "info"
              ? "No reports are waiting on additional information."
              : tab === "rejected"
                ? "No rejected reports. Invalid reports stay stored here with the rejection reason."
                : "No verified reports yet. A warning can only be issued on a verified report."}
        </div>
      )}

      <div className="rc-list">
        {!loading &&
          reports.map((report) => (
            <article key={report.id}>
              <button
                type="button"
                className="rc-card"
                onClick={() => onOpen(report)}
              >
                <header className="rc-card-head">
                  <div className="rc-card-title">
                    <span className={`rc-sev ${SEVERITY_CLASS[report.severityLevel]}`}>
                      {label(report.severityLevel)}
                    </span>
                    <h3>
                      {label(report.hazardType)} reported in {report.locationDistrict}
                    </h3>
                  </div>
                  <div className="sp-badges" style={{ justifyContent: "flex-end" }}>
                    <span className="sp-pill sp-pill-plain sp-mono">{report.reportId}</span>
                    <span className={`rc-status ${STATUS_META[report.status].className}`}>
                      {STATUS_META[report.status].label}
                    </span>
                  </div>
                </header>

                <div className="sp-stack" style={{ marginBottom: 12 }}>
                  <span className="rc-field-label">Citizen&rsquo;s report</span>
                  <div className="sp-block">{report.description}</div>
                </div>

                <div className="sp-list">
                  <div className="sp-row">
                    <span className="sp-label">Reported by</span>
                    <span className="sp-value">{report.reporterName ?? "Anonymous citizen"}</span>
                  </div>
                  <div className="sp-row">
                    <span className="sp-label">Contact</span>
                    <span className="sp-value sp-mono">{report.reporterPhone ?? "—"}</span>
                  </div>
                  {report.locationLat !== undefined && report.locationLng !== undefined && (
                    <div className="sp-row">
                      <span className="sp-label">Coordinates</span>
                      <span className="sp-value sp-mono">
                        {report.locationLat.toFixed(4)},{" "}
                        {report.locationLng.toFixed(4)}
                      </span>
                    </div>
                  )}
                  <div className="sp-row">
                    <span className="sp-label">People affected</span>
                    <span className="sp-value">
                      {report.affectedPopulation ? `~${report.affectedPopulation}` : "—"}
                    </span>
                  </div>
                  <div className="sp-row">
                    <span className="sp-label">Received</span>
                    <span className="sp-value">{relativeTime(report.createdAt)}</span>
                  </div>
                  <div className="sp-row">
                    <span className="sp-label">Warnings issued</span>
                    <span className="sp-value">{report.warningCount ?? 0}</span>
                  </div>
                  {report.immediateDanger && (
                    <div className="sp-row">
                      <span className="sp-label">Danger flag</span>
                      <span className="sp-value">
                        <span className="sp-pill sp-pill-red">Immediate danger</span>
                      </span>
                    </div>
                  )}
                  {report.attachments.length > 0 && (
                    <div className="sp-row">
                      <span className="sp-label">Evidence</span>
                      <span className="sp-value">{report.attachments.length} attached</span>
                    </div>
                  )}
                </div>

                {report.attachments.length > 0 && (
                  <div className="rc-thumbstrip">
                    {report.attachments.slice(0, 4).map((attachment) => (
                      <img
                        key={attachment.id}
                        className="rc-thumb"
                        src={attachment.fileUrl}
                        alt="Evidence thumbnail"
                      />
                    ))}
                  </div>
                )}
              </button>

              {tab === "verified" && (
                <div className="rc-actions" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="rc-button rc-button-issue"
                    onClick={() => onIssueWarning(report.id)}
                  >
                    <Megaphone size={15} /> Issue warning for this report
                  </button>
                </div>
              )}
            </article>
          ))}
      </div>
    </div>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
