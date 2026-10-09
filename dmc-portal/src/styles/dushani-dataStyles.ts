import { Colors } from "../constants/theme";
import type { SeverityLevel } from "../types/hazardReport";
import type { BroadcastStatus, ChannelType, WarningStatus } from "../types/warning";

const Hairline = "#EAECF0";
const Divider = "#F2F4F7";
const Surface = "#F9FAFB";
const RedTint = "#FEF3F2";
const GreenTint = "#DCFCE7";
const GreenText = "#166534";
const AmberTint = "#FEF0C7";
const AmberText = "#7A5310";
const BlueTint = "#D1E9FF";
const Mono =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

/**
 * One vocabulary for presenting facts, shared by every portal surface so a
 * report, a warning and a profile all break their details into the same rows.
 * Render it once per page with `<style>{DATA_STYLES}</style>`.
 */
export const DATA_STYLES = `
  .sp-list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sp-row,
  dl.sp-row {
    display: grid;
    grid-template-columns: minmax(120px, 168px) 1fr;
    align-items: baseline;
    gap: 4px 16px;
    margin: 0;
    padding: 9px 0;
    border-bottom: 1px solid ${Divider};
  }

  .sp-list > .sp-row:last-child,
  .sp-list > dl.sp-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .sp-list > .sp-row:first-child,
  .sp-list > dl.sp-row:first-child {
    padding-top: 0;
  }

  .sp-label,
  .sp-row > dt {
    margin: 0;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.085em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .sp-value,
  .sp-row > dd {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.5;
    color: ${Colors.text};
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  .sp-value-regular {
    font-weight: 500;
  }

  .sp-mono {
    font-family: ${Mono};
    font-size: 12px;
    letter-spacing: 0.01em;
  }

  .sp-muted {
    color: ${Colors.muted};
    font-weight: 600;
  }

  /* Two facts per line when both are short. */
  .sp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .sp-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 11px 13px;
    border: 1px solid ${Hairline};
    border-radius: 10px;
    background: ${Surface};
  }

  .sp-cell .sp-label {
    font-size: 9.5px;
    letter-spacing: 0.1em;
  }

  /* Label/value pairs on one wrapping line - facts inside a compact row. */
  .sp-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 20px;
  }

  .sp-fact {
    display: inline-flex;
    align-items: baseline;
    gap: 7px;
    min-width: 0;
  }

  .sp-fact .sp-label {
    font-size: 9.5px;
    letter-spacing: 0.09em;
  }

  .sp-fact .sp-value {
    font-size: 12px;
  }

  /* Bullets instead of a sentence joined by separators. */
  .sp-bullets {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sp-bullets > li {
    position: relative;
    padding-left: 16px;
    font-size: 12.5px;
    font-weight: 500;
    line-height: 1.55;
    color: ${Colors.text};
  }

  .sp-bullets > li::before {
    content: "";
    position: absolute;
    left: 2px;
    top: 7px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${Colors.border};
  }

  .sp-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .sp-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px 3px 8px;
    border: 1px solid ${Colors.border};
    border-radius: 999px;
    background: ${Colors.white};
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.02em;
    line-height: 1.5;
    color: ${Colors.text};
    white-space: nowrap;
  }

  .sp-pill::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .sp-pill-plain::before {
    display: none;
  }

  .sp-pill-red {
    border-color: #FDA29B;
    background: ${RedTint};
    color: ${Colors.redDark};
  }

  .sp-pill-green {
    border-color: #A7F3C0;
    background: ${GreenTint};
    color: ${GreenText};
  }

  .sp-pill-amber {
    border-color: #FDCF5F;
    background: ${AmberTint};
    color: ${AmberText};
  }

  .sp-pill-blue {
    border-color: #B2DDFF;
    background: ${BlueTint};
    color: ${Colors.blueDark};
  }

  .sp-pill-slate {
    background: ${Surface};
    color: ${Colors.muted};
  }

  /* A single instruction or quote worth isolating from the facts around it. */
  .sp-block {
    padding: 11px 13px;
    border: 1px solid ${Hairline};
    border-left: 3px solid ${Colors.navy};
    border-radius: 10px;
    background: ${Surface};
    font-size: 13px;
    font-weight: 600;
    line-height: 1.55;
    color: ${Colors.text};
  }

  .sp-block-red {
    border-color: #FDA29B;
    border-left-color: ${Colors.red};
    background: ${RedTint};
    color: ${Colors.redDark};
  }

  .sp-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sp-empty {
    padding: 14px 16px;
    border: 1px dashed ${Colors.border};
    border-radius: 10px;
    background: ${Surface};
    font-size: 12.5px;
    font-weight: 500;
    line-height: 1.6;
    color: ${Colors.muted};
  }

  /* Delivery share as a bar rather than "1,203/1,204 delivered" prose. */
  .sp-meter {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .sp-meter-track {
    flex: 1;
    height: 6px;
    min-width: 60px;
    border-radius: 999px;
    background: ${Divider};
    overflow: hidden;
  }

  .sp-meter-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: ${Colors.success};
    transition: width 420ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .sp-meter-fill-red {
    background: ${Colors.red};
  }

  .sp-meter-fill-amber {
    background: ${Colors.amber};
  }

  .sp-meter-value {
    font-family: ${Mono};
    font-size: 11.5px;
    font-weight: 700;
    color: ${Colors.text};
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* Compact table for logs and per-channel rows. */
  .sp-table {
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid ${Hairline};
    border-radius: 10px;
    overflow: hidden;
  }

  .sp-table-head,
  .sp-table-row {
    display: grid;
    grid-template-columns: minmax(96px, 1fr) minmax(110px, 1.2fr) minmax(120px, 1.4fr);
    gap: 12px;
    padding: 9px 12px;
    align-items: center;
  }

  .sp-table-head {
    background: ${Surface};
    border-bottom: 1px solid ${Hairline};
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .sp-table-row + .sp-table-row {
    border-top: 1px solid ${Divider};
  }

  .sp-table-row {
    background: ${Colors.white};
    font-size: 12.5px;
  }

  @media (max-width: 720px) {
    .sp-row,
    dl.sp-row {
      grid-template-columns: 1fr;
      gap: 2px;
    }

    .sp-table-head {
      display: none;
    }

    .sp-table-row {
      grid-template-columns: 1fr;
      gap: 4px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sp-meter-fill {
      transition: none;
    }
  }
`;

/** Severity always reads as the same colour, whoever renders the row. */
export function severityPill(severity: SeverityLevel): string {
  if (severity === "CRITICAL") return "sp-pill-red";
  if (severity === "HIGH") return "sp-pill-amber";
  if (severity === "MEDIUM") return "sp-pill-blue";

  return "sp-pill-slate";
}

export function statusPill(status: WarningStatus): string {
  if (status === "ACTIVE") return "sp-pill-red";
  if (status === "DRAFT" || status === "PENDING_DISPATCH") return "sp-pill-amber";

  return "sp-pill-slate";
}

export function deliveryPill(status: BroadcastStatus): string {
  if (status === "SUCCESS") return "sp-pill-green";
  if (status === "PARTIAL") return "sp-pill-amber";
  if (status === "FAILED") return "sp-pill-red";

  return "sp-pill-slate";
}

export function meterTone(status: BroadcastStatus): string {
  if (status === "FAILED") return "sp-meter-fill-red";
  if (status === "PARTIAL" || status === "PENDING") return "sp-meter-fill-amber";

  return "";
}

/** A channel name a citizen-facing officer can read, not the DB enum. */
export function channelLabel(channel: ChannelType): string {
  if (channel === "push") return "Push notification";
  if (channel === "sms") return "Text and app inbox";

  return "Siren relay";
}

/** The outcome of a channel, phrased as a state rather than a gateway error. */
export function deliveryLabel(status: BroadcastStatus): string {
  if (status === "SUCCESS") return "Delivered";
  if (status === "PARTIAL") return "Part delivered";
  if (status === "FAILED") return "Failed";
  if (status === "PENDING") return "Waiting";

  return "No receivers";
}

/** Only a real send failure may be coloured as an error. */
export function isDeliveryError(status: BroadcastStatus): boolean {
  return status === "FAILED";
}

/**
 * A skipped channel means nobody was reachable, not that a send failed - the
 * warning is still stored in every targeted account's in-app alert inbox.
 */
export function skippedCopy(
  channel: ChannelType
): { reason: string; nextStep: string } {
  if (channel === "push") {
    return {
      reason: "No phone in this district has notifications enabled",
      nextStep: "Open the citizen app once and allow notifications",
    };
  }

  if (channel === "sms") {
    return {
      reason: "No targeted account has a phone number",
      nextStep: "Nothing to fix - the warning still reaches the app inbox",
    };
  }

  return {
    reason: "No siren station answered the relay",
    nextStep: "Point SIREN_RELAY_URL at the station network",
  };
}
