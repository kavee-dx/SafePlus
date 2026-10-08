import { useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Loader2,
  MapPin,
  Megaphone,
  MessageSquarePlus,
} from "lucide-react";

import {
  requestMoreInfo,
  type ExtendedReport,
} from "../services/amasha-reportApi";
import { AlertApiError } from "../services/dushani-alertApi";
import {
  SEVERITY_CLASS,
  STATUS_META,
  formatDateTime,
  label,
  relativeTime,
} from "./amasha-reportUi";

interface ReportDetailViewProps {
  report: ExtendedReport;
  onBack: () => void;
  onVerify: (report: ExtendedReport) => void;
  onIssueWarning: (reportId: string) => void;
  onChanged: () => void;
}

export default function ReportDetailView({
  report,
  onBack,
  onVerify,
  onIssueWarning,
  onChanged,
}: ReportDetailViewProps) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRequestInfo = report.status === "PENDING_VERIFICATION";

  async function submitRequestInfo() {
    setBusy(true);
    setError(null);

    try {
      await requestMoreInfo(report.id, reason.trim());
      onChanged();
    } catch (requestError) {
      setError(
        requestError instanceof AlertApiError
          ? requestError.fieldErrors.reason ?? requestError.message
          : "Could not send the request."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rc">
      <div className="rc-page-head">
        <button type="button" className="rc-back" onClick={onBack}>
          <ArrowLeft size={15} /> Back to queue
        </button>
        <span className={`rc-status ${STATUS_META[report.status].className}`}>
          {STATUS_META[report.status].label}
        </span>
      </div>

      <div className="rc-columns">
        <div className="rc" style={{ gap: 18 }}>
          <section className="rc-panel">
            <div className="rc-card-title" style={{ marginBottom: 16 }}>
              <span className={`rc-sev ${SEVERITY_CLASS[report.severityLevel]}`}>
                {label(report.severityLevel)}
              </span>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                {label(report.hazardType)} · {report.locationDistrict}
              </h3>
            </div>

            <div className="rc-grid">
              <DetailField label="Report reference" value={report.reportId} />
              <DetailField label="Submitted" value={relativeTime(report.createdAt)} />
              <DetailField label="Date & time observed" value={formatDateTime(report.observedAt)} />
              <DetailField
                label="Immediate danger"
                value={report.immediateDanger ? "Yes — people at risk now" : "Not flagged"}
                danger={report.immediateDanger}
              />
              <DetailField label="Reporter" value={report.reporterName ?? "Anonymous citizen"} />
              <DetailField label="Reporter phone" value={report.reporterPhone ?? "—"} />
              <DetailField
                label="Estimated people affected"
                value={report.affectedPopulation ? `~${report.affectedPopulation}` : "—"}
              />
              <DetailField label="Affected area / landmark" value={report.landmark ?? "—"} />
              <DetailField
                label="GPS location"
                value={
                  report.locationLat !== undefined && report.locationLng !== undefined
                    ? `${report.locationLat.toFixed(5)}, ${report.locationLng.toFixed(5)}`
                    : "Not attached"
                }
                icon={<MapPin size={13} />}
              />
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="rc-field-label">Description</div>
              <p className="rc-description" style={{ marginTop: 6 }}>
                {report.description}
              </p>
            </div>
          </section>

          <section className="rc-panel">
            <h2>Evidence ({report.attachments.length})</h2>
            {report.attachments.length === 0 ? (
              <p className="rc-empty">
                No photo or video was attached (alternative flow A1). Verify using the
                description, location and reporter contact.
              </p>
            ) : (
              <div className="rc-evidence">
                {report.attachments.map((attachment) => (
                  <figure key={attachment.id}>
                    {attachment.fileKind === "VIDEO" ? (
                      <video src={attachment.fileUrl} controls />
                    ) : (
                      <img src={attachment.fileUrl} alt="Report evidence" />
                    )}
                    <figcaption>
                      {attachment.fileKind === "VIDEO" ? "Video" : "Photo"}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="rc" style={{ gap: 18 }}>
          <section className="rc-panel">
            <h2>Decision</h2>

            {report.status === "PENDING_VERIFICATION" && (
              <div className="rc-actions" style={{ flexDirection: "column" }}>
                <button
                  type="button"
                  className="rc-button rc-button-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => onVerify(report)}
                >
                  <CheckCircle size={16} /> Verify or reject this report
                </button>
                <button
                  type="button"
                  className="rc-button rc-button-info"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => setAsking((current) => !current)}
                >
                  <MessageSquarePlus size={16} /> Request more information
                </button>
              </div>
            )}

            {report.status === "ADDITIONAL_INFO_REQUIRED" && (
              <div className="rc-note-box">
                Waiting on the citizen. You asked: “{report.infoRequestReason}” on{" "}
                {formatDateTime(report.infoRequestedAt)}. The report returns to the queue
                once they update it.
              </div>
            )}

            {report.status === "VERIFIED" && (
              <div className="rc-actions" style={{ flexDirection: "column" }}>
                <div className="rc-note-box">
                  Verified {formatDateTime(report.verifiedAt)}
                  {report.verifiedByName ? ` by ${report.verifiedByName}` : ""}
                  {report.verificationNotes ? ` — ${report.verificationNotes}` : ""}
                </div>
                <button
                  type="button"
                  className="rc-button rc-button-issue"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => onIssueWarning(report.id)}
                >
                  <Megaphone size={16} /> Issue warning for this report
                </button>
              </div>
            )}

            {report.status === "REJECTED" && (
              <div className="rc-note-box">
                Rejected {formatDateTime(report.verifiedAt)}
                {report.verifiedByName ? ` by ${report.verifiedByName}` : ""}. Reason:{" "}
                {report.verificationNotes ?? "—"}
              </div>
            )}

            {asking && canRequestInfo && (
              <div className="rc-decision" style={{ marginTop: 16 }}>
                <label className="rc-field-label" htmlFor="rc-reason">
                  What do you need from the citizen?
                </label>
                <textarea
                  id="rc-reason"
                  className="rc-textarea"
                  value={reason}
                  placeholder="e.g. Please add a photo of the water level and confirm the nearest landmark."
                  onChange={(event) => setReason(event.target.value)}
                />
                {error && <span className="rc-field-error">{error}</span>}
                <button
                  type="button"
                  className="rc-button rc-button-info"
                  disabled={busy || reason.trim().length < 10}
                  onClick={() => void submitRequestInfo()}
                >
                  {busy ? <Loader2 className="rc-spin" size={15} /> : <AlertTriangle size={15} />}
                  Send request to citizen
                </button>
              </div>
            )}
          </section>

          <section className="rc-panel">
            <h2>Timeline</h2>
            <ul className="rc-timeline">
              <li>
                <span className="rc-dot" />
                <span>
                  Submitted by {report.reporterName ?? "a citizen"} ·{" "}
                  {formatDateTime(report.createdAt)}
                </span>
              </li>
              {report.infoRequestedAt && (
                <li>
                  <span className="rc-dot" />
                  <span>More information requested · {formatDateTime(report.infoRequestedAt)}</span>
                </li>
              )}
              {report.verifiedAt && (
                <li>
                  <span className="rc-dot" />
                  <span>
                    {report.status === "VERIFIED" ? "Verified" : "Decided"} ·{" "}
                    {formatDateTime(report.verifiedAt)}
                  </span>
                </li>
              )}
              {(report.warningCount ?? 0) > 0 && (
                <li>
                  <span className="rc-dot" />
                  <span>
                    {report.warningCount} warning{report.warningCount === 1 ? "" : "s"} issued from
                    this report
                  </span>
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function DetailField({
  label: fieldLabel,
  value,
  icon,
  danger,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="rc-field">
      <span className="rc-field-label">{fieldLabel}</span>
      <span className={`rc-field-value ${danger ? "rc-danger" : ""}`}>
        {icon} {value}
      </span>
    </div>
  );
}
