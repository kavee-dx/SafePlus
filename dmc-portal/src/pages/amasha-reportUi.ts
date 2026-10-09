import { Console } from "../styles/dushani-consoleTheme";

const Card = Console.surface;
const Ink = Console.ink;
const InkDim = Console.inkDim;
const White = "#FFFFFF";
const Line = Console.line;
const RedTint = Console.redTint;
const RedText = Console.redInk;
const GreenTint = Console.greenTint;
const GreenText = Console.greenInk;
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
  .rc-tabs { display: inline-flex; background: ${Card}; border: 1px solid ${Line}; border-radius: 10px; padding: 4px; gap: 4px; }
  .rc-tab { border: none; background: transparent; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; color: ${InkDim}; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; }
  .rc-tab-active { background: ${Console.blue}; color: ${White}; }
  .rc-tab-count { background: rgba(0,0,0,0.08); border-radius: 20px; padding: 1px 8px; font-size: 11px; }
  .rc-tab-active .rc-tab-count { background: rgba(255,255,255,0.22); }
  .rc-filters { display: flex; align-items: center; gap: 10px; }
  .rc-select { height: 40px; border: 1px solid ${Line}; border-radius: 9px; background: ${Card}; color: ${Ink}; font-size: 13px; padding: 0 12px; }
  .rc-refresh { display: inline-flex; align-items: center; gap: 7px; height: 40px; padding: 0 14px; border: 1px solid ${Line}; border-radius: 9px; background: ${Card}; color: ${Ink}; font-size: 12px; font-weight: 700; cursor: pointer; }
  .rc-refresh:hover { border-color: ${Console.blueSoft}; color: ${Console.blueSoft}; }

  .rc-banner { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; }
  .rc-banner-error { background: ${RedTint}; color: ${RedText}; }
  .rc-list { display: flex; flex-direction: column; gap: 14px; }

  .rc-card { background: ${Card}; border: 1px solid ${Line}; border-radius: 14px; padding: 20px; text-align: left; width: 100%; cursor: pointer; font: inherit; color: inherit; }
  .rc-card:hover { border-color: ${Console.blueSoft}; box-shadow: 0 12px 28px -14px rgba(2, 8, 20, 0.9); }
  .rc-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 10px; }
  .rc-card-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .rc-card-title h3 { margin: 0; font-size: 16px; font-weight: 800; color: ${Ink}; letter-spacing: -0.02em; }

  .rc-sev { padding: 5px 11px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
  .rc-sev-low { background: ${GreenTint}; color: ${GreenText}; }
  .rc-sev-medium { background: ${Console.amberTint}; color: ${Console.amberInk}; }
  .rc-sev-high { background: ${Console.amberTint}; color: ${Console.amberInk}; }
  .rc-sev-critical { background: ${RedTint}; color: ${RedText}; }

  .rc-status { padding: 5px 11px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 0.03em; white-space: nowrap; }
  .rc-status-pending { background: ${Console.amberTint}; color: ${Console.amberInk}; }
  .rc-status-info { background: ${Console.blueTint}; color: ${Console.blueInk}; }
  .rc-status-verified { background: ${GreenTint}; color: ${GreenText}; }
  .rc-status-rejected { background: ${RedTint}; color: ${RedText}; }

  .rc-thumbstrip { display: flex; gap: 8px; margin-top: 12px; }
  .rc-thumb { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; border: 1px solid ${Line}; background: ${Console.bgDeep}; }

  /* Detail + verify pages */
  .rc-page-head { display: flex; align-items: center; gap: 12px; }
  .rc-back { display: inline-flex; align-items: center; gap: 7px; height: 40px; padding: 0 14px; border: 1px solid ${Line}; border-radius: 9px; background: ${Card}; color: ${Ink}; font-size: 13px; font-weight: 700; cursor: pointer; }
  .rc-back:hover { border-color: ${Console.blueSoft}; color: ${Console.blueSoft}; }
  .rc-panel { background: ${Card}; border: 1px solid ${Line}; border-radius: 14px; padding: 22px; }
  .rc-panel h2 { margin: 0 0 14px; font-size: 15px; font-weight: 800; color: ${Ink}; }
  .rc-field-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${InkDim}; }
  .rc-columns { display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px; align-items: start; }
  .rc-evidence { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .rc-evidence figure { margin: 0; }
  .rc-evidence img, .rc-evidence video { width: 100%; height: 150px; object-fit: cover; border-radius: 12px; border: 1px solid ${Line}; background: ${Console.bgDeep}; }
  .rc-evidence figcaption { font-size: 11px; color: ${InkDim}; margin-top: 5px; text-align: center; }

  .rc-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .rc-button { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid transparent; }
  .rc-button:disabled { opacity: 0.55; cursor: not-allowed; }
  .rc-button-verify { background: ${Console.green}; color: ${White}; }
  .rc-button-reject { background: ${Card}; border-color: ${Line}; color: ${RedText}; }
  .rc-button-info { background: ${Console.blueTint}; color: ${Console.blueInk}; }
  .rc-button-issue { background: ${Console.red}; color: ${White}; }
  .rc-button-primary { background: ${Console.blue}; color: ${White}; }

  .rc-decision { display: flex; flex-direction: column; gap: 10px; }
  .rc-choice { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 1px solid ${Line}; border-radius: 12px; cursor: pointer; background: ${Card}; }
  .rc-choice-active { border-color: ${Console.blueSoft}; box-shadow: 0 0 0 3px ${Console.blueTint}; }
  .rc-choice h4 { margin: 0; font-size: 14px; font-weight: 800; color: ${Ink}; }
  .rc-choice p { margin: 3px 0 0; font-size: 12px; color: ${InkDim}; }
  .rc-textarea { width: 100%; min-height: 96px; border: 1px solid ${Line}; border-radius: 10px; padding: 12px; font-size: 13px; font-family: inherit; color: ${Ink}; resize: vertical; }
  .rc-textarea:focus { outline: none; border-color: ${Console.blueSoft}; }
  .rc-field-error { font-size: 12px; font-weight: 600; color: ${RedText}; }
  .rc-spin { animation: rc-spin 900ms linear infinite; }
  @keyframes rc-spin { to { transform: rotate(360deg); } }

  @media (max-width: 900px) {
    .rc-columns { grid-template-columns: 1fr; }
  }
`;
