import {
  Activity,
  AlertTriangle,
  Anchor,
  CloudRain,
  Droplets,
  Factory,
  Flame,
  Mountain,
  Sun,
  Tornado,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { DistrictTeamCard } from "../services/kaveesha-districtTeamsApi";

/* ------------------------------------------------------------------ *
 * The disasters a district has to be ready for.
 *
 * These are the choices a citizen is given when filing a hazard report — the
 * citizen app's HAZARDS pairs, mirrored by the hazard_reports check constraint —
 * so an officer reads the same words the report arrived with rather than a
 * rescue-team vocabulary laid over them. Keep this list in step with
 * backend/migrations/hazard_reports.sql; LANDSLIDE_RISK is left out on purpose
 * because no report form offers it, and adding it here without a matching
 * discipline would only draw another empty row.
 * ------------------------------------------------------------------ */

export interface DisasterKind {
  code: string;
  label: string;
  icon: LucideIcon;
}

export const DISASTER_KINDS: DisasterKind[] = [
  { code: "FLOOD", label: "Flood", icon: Droplets },
  { code: "LANDSLIDE", label: "Landslide", icon: Mountain },
  { code: "WILDFIRE", label: "Fire", icon: Flame },
  { code: "CYCLONE", label: "Cyclone", icon: Tornado },
  { code: "DROUGHT", label: "Drought", icon: Sun },
  { code: "TSUNAMI", label: "Tsunami", icon: Waves },
  { code: "HEAVY_RAIN", label: "Heavy rain", icon: CloudRain },
  { code: "STRONG_WIND", label: "Strong wind", icon: Wind },
  { code: "LIGHTNING", label: "Lightning", icon: Zap },
  { code: "COASTAL_EROSION", label: "Coastal erosion", icon: Anchor },
  { code: "EPIDEMIC", label: "Epidemic", icon: Activity },
  { code: "INDUSTRIAL_ACCIDENT", label: "Industrial accident", icon: Factory },
  { code: "OTHER", label: "Something else", icon: AlertTriangle },
];

/** The disaster's own words, taken from the label a citizen chose. */
export function disasterTerms(label: string): string[] {
  return label
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 2);
}

/**
 * Which teams answer which disaster, decided by what the team is already
 * registered as. No list of teams per disaster is written here, and no count is:
 * a crew is drawn under a disaster when the disaster's own name appears in its
 * discipline or in one of its recorded capabilities — "Flood Rescue" answers
 * Flood, "Fire & Rescue" answers Fire, a team carrying the "Landslide Rescue"
 * capability counts against a landslide. A Multi-Hazard Rescue team is registered
 * to answer anything, so it belongs on every row.
 *
 * The consequence is worth stating plainly, because it is the point: a district
 * whose verified roster is flood, fire and landslide crews sees three disasters
 * with cover and ten without. That is the real picture, not a chart failure, and
 * an officer should be shown the ten rather than a generous guess about who
 * could help with a cyclone.
 *
 * Should a team ever be registered against disaster codes directly, this match is
 * replaced by that field rather than extended by hand.
 */
export function answersDisaster(
  card: DistrictTeamCard,
  terms: string[]
): boolean {
  const registered = [card.teamType, ...card.capabilities].map((name) =>
    name.toLowerCase()
  );

  if (registered.some((name) => name.includes("multi-hazard"))) return true;

  return terms.some((term) => registered.some((name) => name.includes(term)));
}

/** Teams able to answer one disaster, read off the roster in scope. */
export function teamsForDisaster(
  teams: DistrictTeamCard[],
  kind: DisasterKind
): DistrictTeamCard[] {
  const terms = disasterTerms(kind.label);

  return teams.filter((team) => answersDisaster(team, terms));
}

/* ------------------------------------------------------------------ *
 * One palette for the three states a team can be in, shared by the dashboard's
 * readiness meter and the force board, because a bar and the dot that names it
 * have to be the same colour or the chart needs a second legend.
 *
 * Deliberately not the red/amber/green the severity boxes use: those say how bad
 * something is, these say where a team is, and reading them with the same eyes
 * would be a mistake.
 * ------------------------------------------------------------------ */

export const FORCE_COVER = {
  available: "#0E9A94",
  availableLight: "#22C3BD",
  deployed: "#5B4FD6",
  deployedLight: "#8A7BFF",
  resting: "#8C99AD",
  restingLight: "#A9B4C8",
};
