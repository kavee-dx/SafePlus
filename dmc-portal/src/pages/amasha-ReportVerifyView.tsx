import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  MessageSquarePlus,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import type { ExtendedReport } from "../services/amasha-reportApi";
import { requestMoreInfo } from "../services/amasha-reportApi";
import { AlertApiError, verifyReport } from "../services/dushani-alertApi";
import { SEVERITY_CLASS, formatDateTime, label } from "./amasha-reportUi";

type Decision = "VERIFIED" | "REJECTED" | "REQUEST_INFO";

interface ReportVerifyViewProps {
  report: ExtendedReport;
  onBack: () => void;
  onDecided: () => void;
}

const CHOICES: { key: Decision; title: string; body: string; needsNote: boolean }[] = [
  {
    key: "VERIFIED",
    title: "Verify — the report is truthful",
    body: "Unlocks issuing a location-based warning on this report.",
    needsNote: false,
  },
  {
    key: "REJECTED",
    title: "Reject — cannot be confirmed",
    body: "A reason is required and the citizen is told why (alternative flow A3).",
    needsNote: true,
  },
  {
    key: "REQUEST_INFO",
    title: "Request more information",
    body: "Sends the report back to the citizen; it returns to the queue when they update it (A2).",
    needsNote: true,
  },
];

export default function ReportVerifyView({
  report,
  onBack,
  onDecided,
}: ReportVerifyViewProps) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = CHOICES.find((choice) => choice.key === decision);
  const noteRequired = selected?.needsNote ?? false;
  const canSubmit = decision !== null && (!noteRequired || notes.trim().length >= 10);

  async function submit() {
    if (!decision) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (decision === "REQUEST_INFO") {
        await requestMoreInfo(report.id, notes.trim());
      } else {
        // Verification uses the public RPT- reference through the existing gate.
        await verifyReport(report.reportId, decision, notes.trim() || undefined);
      }

      onDecided();
    } catch (submitError) {
      if (submitError instanceof AlertApiError) {
        setError(
          submitError.fieldErrors.verificationNotes ??
            submitError.fieldErrors.reason ??
            submitError.message
        );
      } else {
        setError("The decision could not be recorded. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rc">
      <div className="rc-page-head">
        <button type="button" className="rc-back" onClick={onBack}>
          <ArrowLeft size={15} /> Back to report
        </button>
        <span className="sp-pill sp-pill-plain sp-mono">{report.reportId}</span>
      </div>

      <div className="rc-columns">
        <section className="rc-panel">
          <h2>
            <ShieldCheck size={16} style={{ marginRight: 8, verticalAlign: -2 }} />
            Verify against the truth evidence
          </h2>

          <div className="rc-card-title" style={{ marginBottom: 12 }}>
            <span className={`rc-sev ${SEVERITY_CLASS[report.severityLevel]}`}>
              {label(report.severityLevel)}
            </span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
              {label(report.hazardType)} reported in {report.locationDistrict}
            </h3>
          </div>

          <div className="sp-stack" style={{ marginBottom: 16 }}>
            <span className="rc-field-label">Citizen&rsquo;s report</span>
            <div className="sp-block">{report.description}</div>
          </div>

          <div className="sp-list" style={{ marginBottom: 16 }}>
            <div className="sp-row">
              <span className="sp-label">Observed</span>
              <span className="sp-value">{formatDateTime(report.observedAt)}</span>
            </div>
            <div className="sp-row">
              <span className="sp-label">Reported by</span>
              <span className="sp-value">{report.reporterName ?? "Anonymous"}</span>
            </div>
            <div className="sp-row">
              <span className="sp-label">Contact</span>
              <span className="sp-value sp-mono">{report.reporterPhone ?? "—"}</span>
            </div>
            <div className="sp-row">
              <span className="sp-label">Landmark</span>
              <span className="sp-value">{report.landmark ?? "—"}</span>
            </div>
            <div className="sp-row">
              <span className="sp-label">GPS coordinates</span>
              <span className="sp-value sp-mono">
                {report.locationLat !== undefined && report.locationLng !== undefined
                  ? report.locationLat.toFixed(5) + ", " + report.locationLng.toFixed(5)
                  : "Not attached"}
              </span>
            </div>
          </div>

          <h2>Evidence</h2>
          {report.attachments.length === 0 ? (
            <div className="sp-empty">
              No photo or video attached (A1). Base the decision on the description,
              location and a call-back to the reporter.
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

        <section className="rc-panel">
          <h2>Record the decision</h2>

          <div className="rc-decision">
            {CHOICES.map((choice) => (
              <button
                key={choice.key}
                type="button"
                className={`rc-choice ${decision === choice.key ? "rc-choice-active" : ""}`}
                onClick={() => {
                  setDecision(choice.key);
                  setError(null);
                }}
              >
                {choice.key === "VERIFIED" ? (
                  <CheckCircle size={20} color="#12B76A" />
                ) : choice.key === "REJECTED" ? (
                  <XCircle size={20} color="#B42318" />
                ) : (
                  <MessageSquarePlus size={20} color="#0B5FCD" />
                )}
                <span style={{ textAlign: "left" }}>
                  <h4>{choice.title}</h4>
                  <p>{choice.body}</p>
                </span>
              </button>
            ))}
          </div>

          {noteRequired && (
            <div className="rc-decision" style={{ marginTop: 16 }}>
              <label className="rc-field-label" htmlFor="rc-verify-notes">
                {decision === "REJECTED" ? "Reason for rejection" : "What more do you need?"}
              </label>
              <textarea
                id="rc-verify-notes"
                className="rc-textarea"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="At least 10 characters — the citizen sees this."
              />
            </div>
          )}

          {decision === "VERIFIED" && (
            <div className="rc-decision" style={{ marginTop: 16 }}>
              <label className="rc-field-label" htmlFor="rc-verify-notes-opt">
                Verification note (optional)
              </label>
              <textarea
                id="rc-verify-notes-opt"
                className="rc-textarea"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="e.g. Confirmed against the district officer's ground photo."
              />
            </div>
          )}

          {error && <span className="rc-field-error">{error}</span>}

          <div className="rc-actions" style={{ marginTop: 18 }}>
            <button
              type="button"
              className="rc-button rc-button-primary"
              disabled={!canSubmit || busy}
              onClick={() => void submit()}
            >
              {busy ? <Loader2 className="rc-spin" size={16} /> : <CheckCircle size={16} />}
              Submit decision
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
