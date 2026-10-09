import {
  type ExcludedTeam,
  type IncidentSummary,
  type TeamCandidate,
} from "../models/kaveesha-rescueDispatch";
import { type TeamCandidateRow, listTeamCandidates } from "../repositories/kaveesha-dispatchRepository";

/* ------------------------------------------------------------------ *
 * Smart rescue team recommendation.
 *
 * Rule-based and weighted on purpose: an officer has to be able to read the
 * reason, repeat it over the phone and disagree with it. Every factor is
 * therefore returned next to the score instead of hidden inside it.
 * ------------------------------------------------------------------ */

const WEIGHTS = {
  reach: 0.4,
  capability: 0.3,
  workload: 0.15,
  readiness: 0.15,
};

/** Out-of-district teams stay visible, but their travel is real. */
const MUTUAL_AID_REACH_PENALTY = 0.85;

interface HazardProfile {
  /** Team types raised for this disaster. */
  teamTypes: string[];
  /** Capability tags that count as a fit. */
  capabilities: string[];
  /** Equipment that actually changes what a team can do here. */
  equipment: string[];
  /** Approach speed in km/h. A heuristic, and labelled as one in the UI. */
  roadSpeedKmh: number;
  boatSpeedKmh?: number;
}

const HAZARD_PROFILES: Record<string, HazardProfile> = {
  FLOOD: {
    teamTypes: ["Flood Rescue", "Water Rescue", "Multi-Hazard Rescue"],
    capabilities: ["Flood Rescue", "Water Rescue", "Evacuation"],
    equipment: ["Rescue Boat", "Life Jackets", "Ropes"],
    roadSpeedKmh: 24,
    boatSpeedKmh: 20,
  },
  HEAVY_RAIN: {
    teamTypes: ["Flood Rescue", "Multi-Hazard Rescue", "Search & Rescue"],
    capabilities: ["Flood Rescue", "Evacuation"],
    equipment: ["Life Jackets", "Search Lights", "Radio"],
    roadSpeedKmh: 26,
  },
  CYCLONE: {
    teamTypes: ["Multi-Hazard Rescue", "Search & Rescue", "Medical Rescue"],
    capabilities: ["Evacuation", "Search & Rescue", "Medical / First Aid"],
    equipment: ["Rescue Vehicle", "Radio", "First Aid Kit", "Search Lights"],
    roadSpeedKmh: 24,
  },
  STRONG_WIND: {
    teamTypes: ["Search & Rescue", "Multi-Hazard Rescue"],
    capabilities: ["Search & Rescue", "Evacuation"],
    equipment: ["Rescue Vehicle", "Ropes", "Search Lights"],
    roadSpeedKmh: 28,
  },
  LANDSLIDE: {
    teamTypes: ["Landslide Rescue", "Urban Search & Rescue", "Search & Rescue"],
    capabilities: ["Landslide Rescue", "Search & Rescue"],
    equipment: ["Ropes", "Search Lights", "First Aid Kit", "Drone"],
    roadSpeedKmh: 26,
  },
  LANDSLIDE_RISK: {
    teamTypes: ["Landslide Rescue", "Multi-Hazard Rescue", "Search & Rescue"],
    capabilities: ["Landslide Rescue", "Evacuation", "Search & Rescue"],
    equipment: ["Ropes", "Radio", "Drone"],
    roadSpeedKmh: 28,
  },
  TSUNAMI: {
    teamTypes: ["Water Rescue", "Search & Rescue", "Medical Rescue"],
    capabilities: ["Water Rescue", "Search & Rescue", "Medical / First Aid"],
    equipment: ["Rescue Boat", "Life Jackets", "First Aid Kit"],
    roadSpeedKmh: 22,
    boatSpeedKmh: 18,
  },
  COASTAL_EROSION: {
    teamTypes: ["Water Rescue", "Multi-Hazard Rescue"],
    capabilities: ["Water Rescue", "Evacuation"],
    equipment: ["Life Jackets", "Rescue Vehicle"],
    roadSpeedKmh: 28,
  },
  WILDFIRE: {
    teamTypes: ["Fire & Rescue", "Multi-Hazard Rescue"],
    capabilities: ["Fire Rescue", "Evacuation"],
    equipment: ["Rescue Vehicle", "Radio", "First Aid Kit"],
    roadSpeedKmh: 28,
  },
  DROUGHT: {
    teamTypes: ["Multi-Hazard Rescue", "Medical Rescue"],
    capabilities: ["Evacuation", "Medical / First Aid"],
    equipment: ["Rescue Vehicle"],
    roadSpeedKmh: 32,
  },
  LIGHTNING: {
    teamTypes: ["Medical Rescue", "Search & Rescue"],
    capabilities: ["Medical / First Aid", "Search & Rescue"],
    equipment: ["First Aid Kit", "Radio"],
    roadSpeedKmh: 30,
  },
  EPIDEMIC: {
    teamTypes: ["Medical Rescue"],
    capabilities: ["Medical / First Aid", "Evacuation"],
    equipment: ["First Aid Kit", "Rescue Vehicle"],
    roadSpeedKmh: 32,
  },
  INDUSTRIAL_ACCIDENT: {
    teamTypes: ["Urban Search & Rescue", "Fire & Rescue", "Medical Rescue"],
    capabilities: ["Search & Rescue", "Medical / First Aid", "Fire Rescue"],
    equipment: ["Ropes", "First Aid Kit", "Radio", "Search Lights"],
    roadSpeedKmh: 28,
  },
  OTHER: {
    teamTypes: ["Search & Rescue", "Multi-Hazard Rescue"],
    capabilities: ["Search & Rescue", "Evacuation"],
    equipment: ["Radio", "First Aid Kit"],
    roadSpeedKmh: 32,
  },
};

function profileFor(hazardType: string): HazardProfile {
  return HAZARD_PROFILES[hazardType.toUpperCase()] ?? HAZARD_PROFILES.OTHER;
}

/** Straight-line bands. The UI always says "as-the-crow-flies". */
function reachScore(distanceKm: number): number {
  if (distanceKm <= 2) return 100;
  if (distanceKm <= 5) return 88;
  if (distanceKm <= 10) return 72;
  if (distanceKm <= 20) return 55;
  if (distanceKm <= 35) return 38;

  return 20;
}

function capabilityScore(row: TeamCandidateRow, profile: HazardProfile): number {
  const type = (row.teamType ?? "").trim();

  if (type && profile.teamTypes.includes(type)) return 100;

  const tags = row.capabilities.map((tag) => tag.trim().toLowerCase());
  const matchedTags = profile.capabilities.filter((tag) =>
    tags.includes(tag.trim().toLowerCase())
  );

  if (matchedTags.length >= 2) return 85;
  if (matchedTags.length === 1) return 70;

  // A team that can only move people is still useful when the incident is an
  // evacuation, but it is not the one you send into the water.
  if (tags.includes("evacuation")) return 45;

  return 20;
}

function workloadScore(row: TeamCandidateRow, closedToday: number): number {
  if (row.liveDispatches > 0) return 0;
  if (closedToday === 0) return 100;
  if (closedToday === 1) return 70;

  return 45;
}

function readinessScore(
  row: TeamCandidateRow,
  profile: HazardProfile,
  affectedPopulation?: number
): number {
  const kit = row.equipment.map((item) => item.trim().toLowerCase());
  const relevant = profile.equipment.filter((item) =>
    kit.includes(item.trim().toLowerCase())
  );

  const equipmentPart =
    relevant.length === 0
      ? 35
      : Math.min(100, 70 + (relevant.length - 1) * 15);

  const affected = affectedPopulation ?? 0;

  let peoplePart: number;

  if (affected <= 0) {
    // Nobody estimated the crowd yet, so this says nothing about the team.
    peoplePart = 75;
  } else {
    const ratio = row.memberCount / affected;

    peoplePart =
      ratio >= 0.5 ? 100 : ratio >= 0.2 ? 82 : ratio >= 0.1 ? 60 : 35;
  }

  return Math.round(equipmentPart * 0.7 + peoplePart * 0.3);
}

function etaMinutes(distanceKm: number, profile: HazardProfile, row: TeamCandidateRow): number {
  const byBoat =
    profile.boatSpeedKmh !== undefined &&
    row.equipment.some((item) => item.trim().toLowerCase() === "rescue boat");

  const speed = byBoat ? (profile.boatSpeedKmh ?? profile.roadSpeedKmh) : profile.roadSpeedKmh;

  return Math.max(1, Math.round((distanceKm / speed) * 60));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface Recommendation {
  candidates: TeamCandidate[];
  excluded: ExcludedTeam[];
  /** The team the engine would put first, when there is one. */
  recommendedTeamId?: string;
  searchedRadiusKm: number;
  notes: string[];
}

/**
 * `closedTodayByTeam` comes from the caller so the engine stays a pure function
 * over numbers and can be tested without a database.
 */
export async function recommendTeams(
  incident: IncidentSummary,
  closedTodayByTeam: Record<string, number> = {},
  options: { radiusKm?: number; limit?: number; routePenalty?: number } = {}
): Promise<Recommendation> {
  const radiusKm = options.radiusKm ?? 60;
  const limit = options.limit ?? 12;
  const routePenalty = options.routePenalty ?? 1;

  const notes: string[] = [];

  if (incident.locationLat === undefined || incident.locationLng === undefined) {
    notes.push(
      "This incident has no saved coordinates, so teams are ordered by district and disaster fit only."
    );

    return {
      candidates: [],
      excluded: [],
      searchedRadiusKm: radiusKm,
      notes,
    };
  }

  const rows = await listTeamCandidates(
    { lat: incident.locationLat, lng: incident.locationLng },
    incident.locationDistrict,
    radiusKm
  );

  const profile = profileFor(incident.hazardType);
  const candidates: TeamCandidate[] = [];
  const excluded: ExcludedTeam[] = [];

  for (const row of rows) {
    const base = {
      teamId: row.teamId,
      teamName: row.teamName,
      teamType: row.teamType,
      district: row.district,
      availability: row.availability,
    };

    // Anything but AVAILABLE is refused, so the ranking can never offer a team
    // the dispatch service would turn away.
    if (row.availability === "UNAVAILABLE") {
      excluded.push({ ...base, reason: "The team leader has marked them not available." });

      continue;
    }

    if (row.availability === "ON_DEPLOYMENT") {
      excluded.push({
        ...base,
        reason:
          row.liveDispatches > 0
            ? `Already on ${row.liveDispatches} live mission${row.liveDispatches === 1 ? "" : "s"}.`
            : "Out on a mission that was closed elsewhere; set them available again first.",
      });

      continue;
    }

    if (row.liveDispatches > 0) {
      excluded.push({
        ...base,
        reason: `Already on ${row.liveDispatches} live mission${
          row.liveDispatches === 1 ? "" : "s"
        }.`,
      });

      continue;
    }

    if (row.distanceKm === null) {
      excluded.push({
        ...base,
        reason: "No base location saved, so travel time cannot be judged.",
      });

      continue;
    }

    const outsideDistrict = row.district !== incident.locationDistrict;
    const reachBase = reachScore(row.distanceKm);
    const reach = outsideDistrict
      ? Math.round(reachBase * MUTUAL_AID_REACH_PENALTY)
      : reachBase;
    const capability = capabilityScore(row, profile);
    const workload = workloadScore(row, closedTodayByTeam[row.teamId] ?? 0);
    const readiness = readinessScore(row, profile, incident.affectedPopulation);

    const score =
      (reach * WEIGHTS.reach +
        capability * WEIGHTS.capability +
        workload * WEIGHTS.workload +
        readiness * WEIGHTS.readiness) *
      routePenalty;

    const eta = etaMinutes(row.distanceKm, profile, row);
    const reasons: string[] = [
      `${round(row.distanceKm)} km as-the-crow-flies · about ${eta} min`,
    ];

    if (typeFits(row.teamType, profile)) {
      reasons.push(`${row.teamType} is raised for ${humanize(incident.hazardType)}`);
    } else if (capability >= 70) {
      reasons.push(`Carries the ${profile.capabilities[0]} capability`);
    } else {
      reasons.push("No disaster-specific fit for this incident");
    }

    if (outsideDistrict) {
      reasons.push(`Mutual aid from ${row.district}`);
    }

    const kit = profile.equipment.filter((item) =>
      row.equipment
        .map((entry) => entry.trim().toLowerCase())
        .includes(item.trim().toLowerCase())
    );

    if (kit.length > 0) {
      reasons.push(`Has ${kit.join(", ")}`);
    }

    if (workload < 100) {
      reasons.push(
        `${closedTodayByTeam[row.teamId]} mission${
          closedTodayByTeam[row.teamId] === 1 ? "" : "s"
        } already closed today`
      );
    }

    candidates.push({
      teamId: row.teamId,
      teamName: row.teamName,
      teamType: row.teamType,
      affiliation: row.affiliation,
      organizationName: row.organizationName,
      district: row.district,
      outsideDistrict,
      availability: row.availability,
      leaderFullName: row.leaderFullName,
      leaderPhone: row.leaderPhone,
      leaderDesignation: row.leaderDesignation,
      teamContactNumber: row.teamContactNumber,
      memberCount: row.memberCount,
      capabilities: row.capabilities,
      equipment: row.equipment,
      baseLatitude: row.baseLatitude,
      baseLongitude: row.baseLongitude,
      baseLocationLabel: row.baseLocationLabel,
      distanceKm: round(row.distanceKm),
      etaMinutes: eta,
      score: Math.round(score),
      reasons,
      breakdown: {
        reach: Math.round(reach),
        capability: Math.round(capability),
        workload: Math.round(workload),
        readiness: Math.round(readiness),
      },
      liveDispatches: row.liveDispatches,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);

  if (incident.immediateDanger || incident.severityLevel === "CRITICAL") {
    notes.push(
      "Danger to life is flagged, so mutual-aid teams from neighbouring districts are listed as well."
    );
  }

  const inDistrict = candidates.filter((team) => !team.outsideDistrict).length;

  if (inDistrict === 0 && candidates.length > 0) {
    notes.push(
      `No available team in ${incident.locationDistrict} for this incident — every option below is mutual aid.`
    );
  }

  return {
    candidates: candidates.slice(0, limit),
    excluded: excluded.sort((a, b) => a.teamName.localeCompare(b.teamName)),
    recommendedTeamId: candidates[0]?.teamId,
    searchedRadiusKm: radiusKm,
    notes,
  };
}

function typeFits(teamType: string | undefined, profile: HazardProfile): boolean {
  const type = (teamType ?? "").trim();

  return type !== "" && profile.teamTypes.includes(type);
}

const HAZARD_LABELS: Record<string, string> = {
  HEAVY_RAIN: "heavy rain",
  STRONG_WIND: "strong wind",
  COASTAL_EROSION: "coastal erosion",
  LANDSLIDE_RISK: "landslide risk",
  INDUSTRIAL_ACCIDENT: "industrial accident",
};

function humanize(value: string): string {
  return HAZARD_LABELS[value.toUpperCase()] ?? value.toLowerCase();
}
