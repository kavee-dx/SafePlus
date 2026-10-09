import { useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Loader2,
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
            <h2>Report</h2>
            <div className="rc-card-title" style={{ marginBottom: 14 }}>
              <span className={`rc-sev ${SEVERITY_CLASS[report.severityLevel]}`}>
                {label(report.severityLevel)}
              </span>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                {label(report.hazardType)}
              </h3>
            </div>

            <div className="sp-list">
              <div className="sp-row">
                <span className="sp-label">Report reference</span>
                <span className="sp-value sp-mono">{report.reportId}</span>
              </div>
              <div className="sp-row">
                <span className="sp-label">Submitted</span>
                <span className="sp-value">{relativeTime(report.createdAt)}</span>
              </div>
              <div className="sp-row">
                <span className="sp-label">Date &amp; time observed</span>
                <span className="sp-value">{formatDateTime(report.observedAt)}</span>
              </div>
              <div className="sp-row">
                <span className="sp-label">Immediate danger</span>
                <span className="sp-value">
                  {report.immediateDanger ? (
                    <span className="sp-pill sp-pill-red">Yes — people at risk now</span>
                  ) : (
                    <span className="sp-muted">Not flagged</span>
                  )}
                </span>
              </div>
              <div className="sp-row">
                <span className="sp-label">People affected</span>
                <span className="sp-value">
                  {report.affectedPopulation ? `~${report.affectedPopulation}` : "—"}
                </span>
              </div>
            </div>

            <div className="sp-stack" style={{ marginTop: 16 }}>
              <span className="rc-field-label">Citizen&rsquo;s report</span>
              <div className="sp-block">{report.description}</div>
            </div>
          </section>

          <section className="rc-panel">
            <h2>Location</h2>
            <div className="sp-list">
              <div className="sp-row">
                <span className="sp-label">District</span>
                <span className="sp-value">{report.locationDistrict}</span>
              </div>
              <div className="sp-row">
                <span className="sp-label">GPS coordinates</span>
                <span className="sp-value sp-mono">
                  {report.locationLat !== undefined && report.locationLng !== undefined
                    ? report.locationLat.toFixed(5) + ", " + report.locationLng.toFixed(5)
                    : "Not attached"}
                </span>
              </div>
              <div className="sp-row">
                <span className="sp-label">Affected area / landmark</span>
                <span className="sp-value">{report.landmark ?? "—"}</span>
              </div>
            </div>
          </section>

          <section className="rc-panel">
            <h2>Reporter</h2>
            <div className="sp-list">
              <div className="sp-row">
                <span className="sp-label">Reported by</span>
                <span className="sp-value">{report.reporterName ?? "Anonymous citizen"}</span>
              </div>
              <div className="sp-row">
                <span className="sp-label">Contact</span>
                <span className="sp-value sp-mono">{report.reporterPhone ?? "—"}</span>
              </div>
            </div>
          </section>

          <section className="rc-panel">
            <h2>Evidence ({report.attachments.length})</h2>
            {report.attachments.length === 0 ? (
              <div className="sp-empty">
                No photo or video was attached (alternative flow A1). Verify using the
                description, location and reporter contact.
              </div>
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
              <div className="sp-stack">
                <span className="rc-field-label">You asked the citizen</span>
                <div className="sp-block">“{report.infoRequestReason}”</div>
                <div className="sp-list">
                  <div className="sp-row">
                    <span className="sp-label">Requested on</span>
                    <span className="sp-value">{formatDateTime(report.infoRequestedAt)}</span>
                  </div>
                  <div className="sp-row">
                    <span className="sp-label">Next step</span>
                    <span className="sp-value sp-value-regular">
                      Waiting on the citizen — the report returns to the queue once they
                      update it.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {report.status === "VERIFIED" && (
              <div className="rc-actions" style={{ flexDirection: "column" }}>
                <div className="sp-list">
                  <div className="sp-row">
                    <span className="sp-label">Verified on</span>
                    <span className="sp-value">{formatDateTime(report.verifiedAt)}</span>
                  </div>
                  {report.verifiedByName && (
                    <div className="sp-row">
                      <span className="sp-label">Verified by</span>
                      <span className="sp-value">{report.verifiedByName}</span>
                    </div>
                  )}
                  {report.verificationNotes && (
                    <div className="sp-row">
                      <span className="sp-label">Officer note</span>
                      <span className="sp-value sp-value-regular">
                        {report.verificationNotes}
                      </span>
                    </div>
                  )}
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
              <div className="sp-list">
                <div className="sp-row">
                  <span className="sp-label">Rejected on</span>
                  <span className="sp-value">{formatDateTime(report.verifiedAt)}</span>
                </div>
                {report.verifiedByName && (
                  <div className="sp-row">
                    <span className="sp-label">Rejected by</span>
                    <span className="sp-value">{report.verifiedByName}</span>
                  </div>
                )}
                <div className="sp-row">
                  <span className="sp-label">Reason</span>
                  <span className="sp-value sp-value-regular">
                    {report.verificationNotes ?? "—"}
                  </span>
                </div>
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
            <h2>Status trail</h2>
            <div className="sp-list">
              <div className="sp-row">
                <span className="sp-label">Submitted</span>
                <span className="sp-value">
                  {formatDateTime(report.createdAt)}{" "}
                  <span className="sp-muted">by {report.reporterName ?? "a citizen"}</span>
                </span>
              </div>
              {report.infoRequestedAt && (
                <div className="sp-row">
                  <span className="sp-label">More information requested</span>
                  <span className="sp-value">{formatDateTime(report.infoRequestedAt)}</span>
                </div>
              )}
              {report.verifiedAt && (
                <div className="sp-row">
                  <span className="sp-label">
                    {report.status === "VERIFIED" ? "Verified" : "Decided"}
                  </span>
                  <span className="sp-value">{formatDateTime(report.verifiedAt)}</span>
                </div>
              )}
            </div>
          </section>

          {(report.warningCount ?? 0) > 0 && (
            <section className="rc-panel">
              <h2>Warning linkage</h2>
              <div className="sp-list">
                <div className="sp-row">
                  <span className="sp-label">Warnings issued</span>
                  <span className="sp-value">
                    {report.warningCount} warning{report.warningCount === 1 ? "" : "s"} issued
                    from this report
                  </span>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
