import { Colors } from "../constants/theme";
import type {
  ExtendedReportStatus,
  SeverityLevel,
} from "../services/amasha-reportApi";

export type QueueTab = "pending" | "info" | "verified" | "rejected";

export const SEVERITY_CLASS: Record<SeverityLevel, string> = {
  LOW: "rc-sev-low",
  MEDIUM: "rc-sev-medium",
  HIGH: "rc-sev-high",
  CRITICAL: "rc-sev-critical",
};

export const STATUS_META: Record<
  ExtendedReportStatus,
  { label: string; className: string }
> = {
  PENDING_VERIFICATION: { label: "Awaiting verification", className: "rc-status-pending" },
  ADDITIONAL_INFO_REQUIRED: { label: "Additional information required", className: "rc-status-info" },
  VERIFIED: { label: "Verified", className: "rc-status-verified" },
  REJECTED: { label: "Rejected", className: "rc-status-rejected" },
  RESOLVED: { label: "Resolved", className: "rc-status-verified" },
};

export function label(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

/** Shared stylesheet injected once by the report center. */
export const REPORT_STYLES = `
  .rc { display: flex; flex-direction: column; gap: 18px; }

  .rc-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .rc-tabs { display: inline-flex; background: ${Colors.white}; border: 1px solid ${Colors.border}; border-radius: 10px; padding: 4px; gap: 4px; }
  .rc-tab { border: none; background: transparent; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; color: ${Colors.muted}; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; }
  .rc-tab-active { background: ${Colors.navy}; color: ${Colors.white}; }
  .rc-tab-count { background: rgba(0,0,0,0.08); border-radius: 20px; padding: 1px 8px; font-size: 11px; }
  .rc-tab-active .rc-tab-count { background: rgba(255,255,255,0.22); }
  .rc-filters { display: flex; align-items: center; gap: 10px; }
  .rc-select { height: 40px; border: 1px solid ${Colors.border}; border-radius: 9px; background: ${Colors.white}; color: ${Colors.text}; font-size: 13px; padding: 0 12px; }
  .rc-refresh { display: inline-flex; align-items: center; gap: 7px; height: 40px; padding: 0 14px; border: 1px solid ${Colors.border}; border-radius: 9px; background: ${Colors.white}; color: ${Colors.text}; font-size: 12px; font-weight: 700; cursor: pointer; }
  .rc-refresh:hover { border-color: ${Colors.blue}; color: ${Colors.blue}; }

  .rc-banner { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; }
  .rc-banner-error { background: ${Colors.redLight}; color: ${Colors.redDark}; }
  .rc-state { display: flex; align-items: center; gap: 10px; padding: 22px; border: 1px dashed ${Colors.border}; border-radius: 12px; background: ${Colors.white}; color: ${Colors.muted}; font-size: 13px; }
  .rc-list { display: flex; flex-direction: column; gap: 14px; }

  .rc-card { background: ${Colors.white}; border: 1px solid ${Colors.border}; border-radius: 14px; padding: 20px; text-align: left; width: 100%; cursor: pointer; font: inherit; color: inherit; }
  .rc-card:hover { border-color: ${Colors.blue}; box-shadow: 0 6px 20px rgba(16,24,40,0.06); }
  .rc-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 10px; }
  .rc-card-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .rc-card-title h3 { margin: 0; font-size: 16px; font-weight: 800; color: ${Colors.text}; letter-spacing: -0.02em; }
  .rc-report-id { font-size: 11px; font-weight: 700; color: ${Colors.muted}; letter-spacing: 0.04em; }

  .rc-sev { padding: 5px 11px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
  .rc-sev-low { background: #dcfce7; color: #166534; }
  .rc-sev-medium { background: ${Colors.amberLight}; color: ${Colors.amberText}; }
  .rc-sev-high { background: #fef3c7; color: #b54708; }
  .rc-sev-critical { background: ${Colors.redLight}; color: ${Colors.redDark}; }

  .rc-status { padding: 5px 11px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 0.03em; white-space: nowrap; }
  .rc-status-pending { background: ${Colors.amberLight}; color: ${Colors.amberText}; }
  .rc-status-info { background: ${Colors.blueLight}; color: ${Colors.blueDark}; }
  .rc-status-verified { background: #dcfce7; color: #166534; }
  .rc-status-rejected { background: ${Colors.redLight}; color: ${Colors.redDark}; }

  .rc-description { margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: ${Colors.text}; }
  .rc-meta { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: ${Colors.muted}; }
  .rc-meta span { display: inline-flex; align-items: center; gap: 6px; }
  .rc-danger { color: ${Colors.red}; font-weight: 800; }
  .rc-thumbstrip { display: flex; gap: 8px; margin-top: 12px; }
  .rc-thumb { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; border: 1px solid ${Colors.border}; background: ${Colors.background}; }
  .rc-thumb-more { width: 56px; height: 56px; border-radius: 10px; border: 1px dashed ${Colors.border}; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: ${Colors.muted}; }

  /* Detail + verify pages */
  .rc-page-head { display: flex; align-items: center; gap: 12px; }
  .rc-back { display: inline-flex; align-items: center; gap: 7px; height: 40px; padding: 0 14px; border: 1px solid ${Colors.border}; border-radius: 9px; background: ${Colors.white}; color: ${Colors.text}; font-size: 13px; font-weight: 700; cursor: pointer; }
  .rc-back:hover { border-color: ${Colors.blue}; color: ${Colors.blue}; }
  .rc-panel { background: ${Colors.white}; border: 1px solid ${Colors.border}; border-radius: 14px; padding: 22px; }
  .rc-panel h2 { margin: 0 0 14px; font-size: 15px; font-weight: 800; color: ${Colors.text}; }
  .rc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .rc-field { display: flex; flex-direction: column; gap: 4px; }
  .rc-field-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${Colors.muted}; }
  .rc-field-value { font-size: 14px; color: ${Colors.text}; font-weight: 600; }
  .rc-columns { display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px; align-items: start; }
  .rc-evidence { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .rc-evidence figure { margin: 0; }
  .rc-evidence img, .rc-evidence video { width: 100%; height: 150px; object-fit: cover; border-radius: 12px; border: 1px solid ${Colors.border}; background: ${Colors.background}; }
  .rc-evidence figcaption { font-size: 11px; color: ${Colors.muted}; margin-top: 5px; text-align: center; }
  .rc-empty { font-size: 13px; color: ${Colors.muted}; }

  .rc-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .rc-timeline li { display: flex; gap: 10px; font-size: 13px; color: ${Colors.text}; }
  .rc-dot { width: 9px; height: 9px; border-radius: 50%; background: ${Colors.blue}; margin-top: 5px; flex: none; }
  .rc-note-box { background: ${Colors.background}; border: 1px solid ${Colors.border}; border-radius: 10px; padding: 12px; font-size: 13px; color: ${Colors.text}; }

  .rc-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .rc-button { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid transparent; }
  .rc-button:disabled { opacity: 0.55; cursor: not-allowed; }
  .rc-button-verify { background: ${Colors.success}; color: ${Colors.white}; }
  .rc-button-reject { background: ${Colors.white}; border-color: ${Colors.border}; color: ${Colors.redDark}; }
  .rc-button-info { background: ${Colors.blueLight}; color: ${Colors.blueDark}; }
  .rc-button-issue { background: ${Colors.red}; color: ${Colors.white}; }
  .rc-button-primary { background: ${Colors.navy}; color: ${Colors.white}; }

  .rc-decision { display: flex; flex-direction: column; gap: 10px; }
  .rc-choice { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 1px solid ${Colors.border}; border-radius: 12px; cursor: pointer; background: ${Colors.white}; }
  .rc-choice-active { border-color: ${Colors.blue}; box-shadow: 0 0 0 3px ${Colors.blueLight}; }
  .rc-choice h4 { margin: 0; font-size: 14px; font-weight: 800; color: ${Colors.text}; }
  .rc-choice p { margin: 3px 0 0; font-size: 12px; color: ${Colors.muted}; }
  .rc-textarea { width: 100%; min-height: 96px; border: 1px solid ${Colors.border}; border-radius: 10px; padding: 12px; font-size: 13px; font-family: inherit; color: ${Colors.text}; resize: vertical; }
  .rc-textarea:focus { outline: none; border-color: ${Colors.blue}; }
  .rc-field-error { font-size: 12px; font-weight: 600; color: ${Colors.redDark}; }
  .rc-spin { animation: rc-spin 900ms linear infinite; }
  @keyframes rc-spin { to { transform: rotate(360deg); } }

  @media (max-width: 900px) {
    .rc-columns { grid-template-columns: 1fr; }
    .rc-grid { grid-template-columns: 1fr; }
  }
`;
