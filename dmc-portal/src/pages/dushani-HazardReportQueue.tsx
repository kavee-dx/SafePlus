import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Inbox,
  Loader2,
  MapPin,
  Megaphone,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";

import { Colors } from "../constants/theme";
import type { HazardReport, SeverityLevel } from "../types/hazardReport";
import {
  AlertApiError,
  fetchDistricts,
  fetchPendingReports,
  fetchVerifiedReports,
  verifyReport,
} from "../services/dushani-alertApi";

interface HazardReportQueueProps {
  onIssueWarning: (reportId: string) => void;
}

type QueueTab = "pending" | "verified";

const SEVERITY_CLASS: Record<SeverityLevel, string> = {
  LOW: "queue-sev-low",
  MEDIUM: "queue-sev-medium",
  HIGH: "queue-sev-high",
  CRITICAL: "queue-sev-critical",
};

export default function HazardReportQueue({ onIssueWarning }: HazardReportQueueProps) {
  const [tab, setTab] = useState<QueueTab>("pending");
  const [district, setDistrict] = useState("");
  const [districts, setDistricts] = useState<string[]>([]);
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const reload = () => {
    setLoading(true);
    setReloadToken((current) => current + 1);
  };

  useEffect(() => {
    const request =
      tab === "pending" ? fetchPendingReports(district || undefined) : fetchVerifiedReports();

    request
      .then((items) => {
        setReports(items);
        setError(null);
      })
      .catch((loadError) => {
        setError(messageOf(loadError));
        setReports([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [district, tab, reloadToken]);

  useEffect(() => {
    fetchDistricts()
      .then((items) => setDistricts(items.map((item) => item.district).sort()))
      .catch(() => setDistricts([]));
  }, []);

  const decide = async (
    report: HazardReport,
    decision: "VERIFIED" | "REJECTED"
  ) => {
    setBusyId(report.id);
    setError(null);
    setFieldErrors({});

    try {
      await verifyReport(report.id, decision, notes[report.id] || undefined);

      setReports((current) => current.filter((item) => item.id !== report.id));

      if (tab === "verified") {
        setReloadToken((current) => current + 1);
      }
    } catch (decisionError) {
      if (decisionError instanceof AlertApiError) {
        setError(decisionError.message);
        setFieldErrors(decisionError.fieldErrors);
      } else {
        setError(messageOf(decisionError));
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="queue">
      <div className="queue-toolbar">
        <div className="queue-tabs">
          <button
            type="button"
            className={`queue-tab ${tab === "pending" ? "queue-tab-active" : ""}`}
            onClick={() => {
              setLoading(true);
              setTab("pending");
            }}
          >
            Awaiting verification
          </button>
          <button
            type="button"
            className={`queue-tab ${tab === "verified" ? "queue-tab-active" : ""}`}
            onClick={() => {
              setLoading(true);
              setTab("verified");
            }}
          >
            Verified
          </button>
        </div>

        <div className="queue-filters">
          {tab === "pending" && (
            <select
              className="queue-select"
              value={district}
              onChange={(event) => {
                setLoading(true);
                setDistrict(event.target.value);
              }}
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
            className="queue-refresh"
            onClick={reload}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="queue-banner queue-banner-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading && (
        <div className="queue-state">
          <Loader2 className="queue-spin" size={18} /> Loading reports…
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="queue-state">
          <Inbox size={20} />
          {tab === "pending"
            ? "No citizen reports are waiting for verification."
            : "No verified reports yet. A warning can only be issued on a verified report."}
        </div>
      )}

      <div className="queue-list">
        {!loading &&
          reports.map((report) => (
              <article key={report.id} className="queue-card">
                <header className="queue-card-head">
                  <div className="queue-card-title">
                    <span className={`queue-sev ${SEVERITY_CLASS[report.severityLevel]}`}>
                      {label(report.severityLevel)}
                    </span>
                    <h3>{label(report.hazardType)} reported in {report.locationDistrict}</h3>
                  </div>
                  <span className="queue-report-id">{report.reportId}</span>
                </header>

                <p className="queue-description">{report.description}</p>

                <div className="queue-meta">
                  <span>
                    <Users size={13} /> {report.reporterName ?? "Anonymous citizen"}
                    {report.reporterPhone ? ` · ${report.reporterPhone}` : ""}
                  </span>
                  {report.locationLat !== undefined && report.locationLng !== undefined && (
                    <span>
                      <MapPin size={13} /> {report.locationLat.toFixed(4)},{" "}
                      {report.locationLng.toFixed(4)}
                    </span>
                  )}
                  {report.affectedPopulation ? (
                    <span>~{report.affectedPopulation} people affected</span>
                  ) : null}
                  <span>{relativeTime(report.createdAt)}</span>
                  {report.warningCount !== undefined && report.warningCount > 0 && (
                    <span className="queue-warned">
                      <Megaphone size={13} /> {report.warningCount} warning
                      {report.warningCount === 1 ? "" : "s"} already issued
                    </span>
                  )}
                </div>

                {report.status === "VERIFIED" && report.verificationNotes && (
                  <p className="queue-notes">Verification note: {report.verificationNotes}</p>
                )}

                {tab === "pending" ? (
                  <div className="queue-decision">
                    <input
                      className="queue-note-input"
                      placeholder="Notes (required when rejecting)"
                      value={notes[report.id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [report.id]: event.target.value,
                        }))
                      }
                    />
                    {fieldErrors.verificationNotes && (
                      <span className="queue-note-error">
                        {fieldErrors.verificationNotes}
                      </span>
                    )}
                    <div className="queue-actions">
                      <button
                        type="button"
                        className="queue-button queue-button-reject"
                        disabled={busyId === report.id}
                        onClick={() => void decide(report, "REJECTED")}
                      >
                        <XCircle size={15} /> Reject
                      </button>
                      <button
                        type="button"
                        className="queue-button queue-button-verify"
                        disabled={busyId === report.id}
                        onClick={() => void decide(report, "VERIFIED")}
                      >
                        {busyId === report.id ? (
                          <Loader2 className="queue-spin" size={15} />
                        ) : (
                          <CheckCircle size={15} />
                        )}
                        Verify
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="queue-actions">
                    <button
                      type="button"
                      className="queue-button queue-button-issue"
                      onClick={() => onIssueWarning(report.id)}
                    >
                      <Megaphone size={15} /> Issue warning for this report
                    </button>
                  </div>
                )}
              </article>
            ))}
      </div>

      <style>
        {`
          .queue {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }

          .queue-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
          }

          .queue-tabs {
            display: inline-flex;
            background: ${Colors.white};
            border: 1px solid ${Colors.border};
            border-radius: 10px;
            padding: 4px;
            gap: 4px;
          }

          .queue-tab {
            border: none;
            background: transparent;
            padding: 9px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 700;
            color: ${Colors.muted};
            cursor: pointer;
          }

          .queue-tab-active {
            background: ${Colors.navy};
            color: ${Colors.white};
          }

          .queue-filters {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .queue-select,
          .queue-note-input {
            height: 40px;
            border: 1px solid ${Colors.border};
            border-radius: 9px;
            background: ${Colors.white};
            color: ${Colors.text};
            font-size: 13px;
            padding: 0 12px;
          }

          .queue-note-input {
            flex: 1;
            min-width: 200px;
          }

          .queue-select:focus,
          .queue-note-input:focus {
            outline: none;
            border-color: ${Colors.blue};
          }

          .queue-refresh {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            height: 40px;
            padding: 0 14px;
            border: 1px solid ${Colors.border};
            border-radius: 9px;
            background: ${Colors.white};
            color: ${Colors.text};
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }

          .queue-refresh:hover {
            border-color: ${Colors.blue};
            color: ${Colors.blue};
          }

          .queue-banner {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 14px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
          }

          .queue-banner-error {
            background: ${Colors.redLight};
            color: ${Colors.redDark};
          }

          .queue-state {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 22px;
            border: 1px dashed ${Colors.border};
            border-radius: 12px;
            background: ${Colors.white};
            color: ${Colors.muted};
            font-size: 13px;
          }

          .queue-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .queue-card {
            background: ${Colors.white};
            border: 1px solid ${Colors.border};
            border-radius: 14px;
            padding: 20px;
          }

          .queue-card-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
            margin-bottom: 10px;
          }

          .queue-card-title {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
          }

          .queue-card-title h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 800;
            color: ${Colors.text};
            letter-spacing: -0.02em;
          }

          .queue-report-id {
            font-size: 11px;
            font-weight: 700;
            color: ${Colors.muted};
            letter-spacing: 0.04em;
          }

          .queue-sev {
            padding: 5px 11px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .queue-sev-low {
            background: #dcfce7;
            color: #166534;
          }

          .queue-sev-medium {
            background: ${Colors.amberLight};
            color: ${Colors.amberText};
          }

          .queue-sev-high {
            background: #fef3c7;
            color: #b54708;
          }

          .queue-sev-critical {
            background: ${Colors.redLight};
            color: ${Colors.redDark};
          }

          .queue-description {
            margin: 0 0 12px;
            font-size: 14px;
            line-height: 1.6;
            color: ${Colors.text};
          }

          .queue-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 14px;
            font-size: 12px;
            color: ${Colors.muted};
            margin-bottom: 14px;
          }

          .queue-meta span {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }

          .queue-warned {
            color: ${Colors.blue};
            font-weight: 700;
          }

          .queue-notes {
            margin: 0 0 14px;
            font-size: 12px;
            color: ${Colors.muted};
          }

          .queue-decision {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .queue-note-error {
            font-size: 12px;
            font-weight: 600;
            color: ${Colors.redDark};
          }

          .queue-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }

          .queue-button {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            height: 42px;
            padding: 0 18px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            border: 1px solid transparent;
          }

          .queue-button:disabled {
            opacity: 0.55;
            cursor: not-allowed;
          }

          .queue-button-verify {
            background: ${Colors.success};
            color: ${Colors.white};
          }

          .queue-button-reject {
            background: ${Colors.white};
            border-color: ${Colors.border};
            color: ${Colors.redDark};
          }

          .queue-button-issue {
            background: ${Colors.red};
            color: ${Colors.white};
          }

          .queue-button-issue:hover {
            background: ${Colors.redDark};
          }

          .queue-spin {
            animation: queue-spin 900ms linear infinite;
          }

          @keyframes queue-spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 720px) {
            .queue-card-head {
              flex-direction: column;
            }
          }
        `}
      </style>
    </div>
  );
}

function label(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
