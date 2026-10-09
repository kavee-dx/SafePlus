import { Colors } from "../constants/theme";
import type { DispatchStatus } from "../services/kaveesha-dispatchApi";

/* ------------------------------------------------------------------ *
 * Small shared formatting for the dispatch board.
 *
 * The server speaks in UPPER_SNAKE stages and hazard codes. This is the only
 * place the portal turns them into something a control room reads aloud.
 * ------------------------------------------------------------------ */

const HAZARD_LABELS: Record<string, string> = {
  FLOOD: "Flood",
  LANDSLIDE: "Landslide",
  LANDSLIDE_RISK: "Landslide risk",
  CYCLONE: "Cyclone",
  STRONG_WIND: "Strong winds",
  STORM_SURGE: "Storm surge",
  TSUNAMI: "Tsunami",
  HEATWAVE: "Heatwave",
  DROUGHT: "Drought",
  RIVER_EROSION: "River erosion",
  COASTAL_EROSION: "Coastal erosion",
  WOODLAND_FIRE: "Wildfire",
  PEST_INFESTATION: "Pest infestation",
  EPIDEMIC: "Epidemic",
};

const STAGE_LABELS: Record<DispatchStatus, { label: string; tone: string; color: string }> = {
  DISPATCHED: { label: "Dispatched", tone: "warn", color: Colors.amber },
  ACCEPTED: { label: "Accepted", tone: "info", color: Colors.blue },
  EN_ROUTE: { label: "On the way", tone: "info", color: Colors.blue },
  ARRIVED: { label: "On scene", tone: "info", color: Colors.blueDark },
  RESCUE_IN_PROGRESS: { label: "Rescue under way", tone: "live", color: Colors.red },
  RETURNING: { label: "Returning", tone: "info", color: Colors.blue },
  COMPLETED: { label: "Completed", tone: "done", color: Colors.success },
  DECLINED: { label: "Declined", tone: "closed", color: Colors.muted },
  CANCELLED: { label: "Stood down", tone: "closed", color: Colors.muted },
};

const LIVE_STAGES: DispatchStatus[] = [
  "DISPATCHED",
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "RESCUE_IN_PROGRESS",
  "RETURNING",
];

export function humanizeHazard(value: string): string {
  const known = HAZARD_LABELS[value.toUpperCase()];

  if (known) return known;

  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function stageMeta(status: DispatchStatus) {
  return STAGE_LABELS[status] ?? {
    label: status.replace(/_/g, " "),
    tone: "closed",
    color: Colors.muted,
  };
}

export function isLiveStage(status: DispatchStatus): boolean {
  return LIVE_STAGES.includes(status);
}

export function severityColor(severity: string): string {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return Colors.red;
    case "HIGH":
      return Colors.amber;
    case "MODERATE":
      return Colors.blue;
    default:
      return Colors.muted;
  }
}

/** Fit score colour: green from 75, blue 55-74, amber below that. */
export function scoreColor(score: number): string {
  if (score >= 75) return Colors.success;
  if (score >= 55) return Colors.blue;

  return Colors.amber;
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return "distance unknown";
  if (km < 1) return `${Math.round(km * 1000)} m`;

  return `${km.toFixed(1)} km`;
}

export function formatEta(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;

  const hours = Math.floor(minutes / 60);

  return `${hours} h ${Math.round(minutes - hours * 60)} min`;
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return "—";

  const then = new Date(value).getTime();

  if (Number.isNaN(then)) return "—";

  const seconds = Math.round((Date.now() - then) / 1000);

  if (seconds < 45) return "just now";
  if (seconds < 90) return "a minute ago";

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours} h ago`;

  const days = Math.round(hours / 24);

  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  return new Date(value).toLocaleDateString();
}

export function clockTime(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return `${date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  })} · ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
