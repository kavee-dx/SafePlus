import { ApiError } from "../utils/apiError";
import {
  RESCUE_TEAM_CAPABILITIES,
  RESCUE_TEAM_EQUIPMENT,
  RESCUE_TEAM_TYPES,
  TEAM_AVAILABILITY_STATES,
} from "../models/registration";
import {
  listVerifiedOrganizations,
  findRescueTeamByUserId,
  resendTeamForReview,
  setTeamAvailability,
  updateRescueTeam,
  findOfficerAssignment,
  listDeployableTeams,
  type DeployableTeamRow,
  type RescueTeamRow,
} from "../repositories/kaveesha-rescueTeamRepository";
import {
  validatePayload,
  splitList,
  normalizeSriLankanNumber,
  required,
  optional,
  positiveInteger,
  oneOf,
  phone,
  latitude,
  longitude,
  listFrom,
  optionalListFrom,
  type FieldErrors,
} from "../validators/registrationValidators";

export interface VerifiedOrganizationOption {
  name: string;
  type: string;
  registrationId: string;
  district: string;
}

export interface RescueTeamDashboard {
  team: {
    name: string;
    type: string;
    size: number;
    district: string;
    contactNumber: string;
    capabilities: string[];
    equipment: string[];
    base: {
      latitude: number | null;
      longitude: number | null;
      label: string | null;
    };
    availability: string;
    affiliation: string;
    registeredAt: string;
    reviewedAt: string | null;
  };
  leader: {
    fullName: string;
    designation: string | null;
    email: string;
    phone: string;
    nicNumber: string | null;
  };
  organization: {
    name: string;
    registrationId: string;
  } | null;
  account: {
    status: string;
    rejectionReason: string | null;
    verifiedAt: string | null;
  };
  review: {
    verifiedBy: string;
    reviewerLabel: string;
    canResubmit: boolean;
    canSetAvailability: boolean;
  };
}

const resubmitValidators = {
  teamName: required("Team name"),
  teamType: oneOf("Team type", RESCUE_TEAM_TYPES),
  teamSize: positiveInteger("Team size"),
  district: required("District"),
  teamContactNumber: phone,
  capabilities: listFrom(
    "Capabilities",
    RESCUE_TEAM_CAPABILITIES,
    1
  ),
  equipment: optionalListFrom("Equipment", RESCUE_TEAM_EQUIPMENT),
  baseLatitude: latitude,
  baseLongitude: longitude,
  baseLocationLabel: optional("Location name"),
  leaderDesignation: optional("Designation"),
};

function uniqueList(value: string): string[] {
  return [...new Set(splitList(value))];
}

function toNumber(value: string): number {
  return Number(String(value).trim());
}

/**
 * A team may only hang itself off an organization a Super Admin has already
 * verified, so the chosen registration ID is checked against that list.
 */
export async function findVerifiedOrganizationByRegistrationId(
  registrationId: string
): Promise<VerifiedOrganizationOption | null> {
  const wanted = registrationId.trim().toLowerCase();

  if (!wanted) return null;

  const organizations = await listVerifiedOrganizations();
  const match = organizations.find(
    (row) => row.registration_number.trim().toLowerCase() === wanted
  );

  if (!match) return null;

  return {
    name: match.name,
    type: match.type,
    registrationId: match.registration_number,
    district: match.district,
  };
}

export async function listVerifiedOrganizationsForForm(): Promise<
  VerifiedOrganizationOption[]
> {
  const rows = await listVerifiedOrganizations();

  return rows.map((row) => ({
    name: row.name,
    type: row.type,
    registrationId: row.registration_number,
    district: row.district,
  }));
}

function toDashboard(row: RescueTeamRow): RescueTeamDashboard {
  const isOrganization = row.affiliation === "ORGANIZATION";
  const reviewerLabel = isOrganization
    ? (row.organization_name ?? "Organization Admin")
    : "Super Admin";

  return {
    team: {
      name: row.team_name,
      type: row.team_type ?? "—",
      size: row.member_count,
      district: row.operating_district,
      contactNumber: row.team_contact_number ?? row.leader_phone_number,
      capabilities: row.capabilities ?? [],
      equipment: row.equipment ?? [],
      base: {
        latitude: row.base_latitude,
        longitude: row.base_longitude,
        label: row.base_location_label,
      },
      availability: row.availability ?? "UNAVAILABLE",
      affiliation: row.affiliation,
      registeredAt: new Date(row.created_at).toISOString(),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    },
    leader: {
      fullName: row.leader_full_name,
      designation: row.leader_designation,
      email: row.leader_email,
      phone: row.leader_phone_number,
      nicNumber: row.leader_nic_number,
    },
    organization:
      isOrganization && row.organization_name
        ? {
            name: row.organization_name,
            registrationId: row.organization_registration_number ?? "—",
          }
        : null,
    account: {
      status: row.account_status,
      rejectionReason: row.rejection_reason,
      verifiedAt: row.verified_at
        ? new Date(row.verified_at).toISOString()
        : null,
    },
    review: {
      verifiedBy: row.verified_by,
      reviewerLabel,
      canResubmit: row.account_status === "REJECTED",
      canSetAvailability: row.account_status === "ACTIVE",
    },
  };
}

export async function getTeamLeaderDashboard(
  userId: string
): Promise<RescueTeamDashboard> {
  const row = await findRescueTeamByUserId(userId);

  if (!row) {
    throw new ApiError(404, "No rescue team profile is linked to this account.");
  }

  return toDashboard(row);
}

/**
 * A rejected leader corrects the team details and puts the request back in the
 * queue that already owns it. The leader cannot move a team between an
 * organization and independent status here - that would change the verifier.
 */
export async function resubmitRescueTeam(
  userId: string,
  payload: Record<string, string>
): Promise<RescueTeamDashboard> {
  const row = await findRescueTeamByUserId(userId);

  if (!row) {
    throw new ApiError(404, "No rescue team profile is linked to this account.");
  }

  if (row.account_status !== "REJECTED") {
    throw new ApiError(
      409,
      "Only a rejected team can be edited and resubmitted."
    );
  }

  const fieldErrors: FieldErrors = validatePayload(payload, resubmitValidators);

  const isOrganization = row.affiliation === "ORGANIZATION";

  if (isOrganization) {
    const nameError = required("Organization")(
      payload.organizationName ?? "",
      payload
    );
    const numberError = required("Organization registration ID", 3)(
      payload.organizationRegistrationNumber ?? "",
      payload
    );

    if (nameError) fieldErrors.organizationName = nameError;
    if (numberError) {
      fieldErrors.organizationRegistrationNumber = numberError;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError(
      400,
      "Please correct the highlighted fields and try again.",
      fieldErrors
    );
  }

  let organizationName: string | null = null;
  let organizationRegistrationNumber: string | null = null;

  if (isOrganization) {
    const organization = await findVerifiedOrganizationByRegistrationId(
      payload.organizationRegistrationNumber ?? ""
    );

    if (!organization) {
      throw new ApiError(
        400,
        "Choose an organization that has already been verified.",
        {
          organizationRegistrationNumber:
            "That organization is not in the verified list.",
        }
      );
    }

    organizationName = organization.name;
    organizationRegistrationNumber = organization.registrationId;
  }

  await updateRescueTeam(userId, {
    team_name: (payload.teamName ?? "").trim(),
    team_type: (payload.teamType ?? "").trim(),
    operating_district: (payload.district ?? "").trim(),
    member_count: toNumber(payload.teamSize ?? "0"),
    team_contact_number: normalizeSriLankanNumber(
      payload.teamContactNumber ?? ""
    ),
    capabilities: uniqueList(payload.capabilities ?? ""),
    equipment: uniqueList(payload.equipment ?? ""),
    base_latitude: toNumber(payload.baseLatitude ?? "0"),
    base_longitude: toNumber(payload.baseLongitude ?? "0"),
    base_location_label: (payload.baseLocationLabel ?? "").trim() || null,
    leader_designation: (payload.leaderDesignation ?? "").trim() || null,
    organization_name: organizationName,
    organization_registration_number: organizationRegistrationNumber,
  });

  await resendTeamForReview(userId);

  return getTeamLeaderDashboard(userId);
}

export async function updateTeamAvailability(
  userId: string,
  availability: string
): Promise<RescueTeamDashboard> {
  const wanted = String(availability ?? "").trim().toUpperCase();

  if (!(TEAM_AVAILABILITY_STATES as readonly string[]).includes(wanted)) {
    throw new ApiError(400, "Choose a valid availability state.");
  }

  const current = await findRescueTeamByUserId(userId);

  if (!current) {
    throw new ApiError(404, "No rescue team profile is linked to this account.");
  }

  if (current.account_status !== "ACTIVE") {
    throw new ApiError(
      403,
      "A team can only be marked available once it has been verified."
    );
  }

  await setTeamAvailability(userId, wanted);

  return getTeamLeaderDashboard(userId);
}

/* ------------------------------------------------------------------ *
 * District rescue board - what a District Officer uses to find teams
 * ------------------------------------------------------------------ */

export interface DistrictTeamCard {
  userId: string;
  teamName: string;
  teamType: string;
  district: string;
  outsideDistrict: boolean;
  availability: string;
  members: number;
  contactNumber: string;
  capabilities: string[];
  equipment: string[];
  leader: {
    fullName: string;
    designation: string | null;
    email: string;
    phone: string;
  };
  base: {
    latitude: number | null;
    longitude: number | null;
    label: string | null;
  };
  organization: {
    name: string;
    registrationId: string;
  } | null;
  affiliation: string;
  verifiedBy: string;
  reviewedAt: string | null;
}

export interface DistrictDisasterGroup {
  type: string;
  teams: number;
  available: number;
  members: number;
}

export interface DistrictOrganizationGroup {
  key: string;
  name: string;
  registrationId: string | null;
  kind: "ORGANIZATION" | "INDEPENDENT";
  districts: string[];
  teams: number;
  available: number;
  members: number;
  disasters: DistrictDisasterGroup[];
  teamCards: DistrictTeamCard[];
}

export interface DistrictRescueBoard {
  officer: {
    fullName: string;
    district: string | null;
    clearanceLevel: string | null;
    scope: "district" | "mutual-aid";
  };
  summary: {
    teams: number;
    available: number;
    onDeployment: number;
    standingDown: number;
    members: number;
    organizations: number;
    disasters: number;
    districts: number;
  };
  disasters: DistrictDisasterGroup[];
  organizations: DistrictOrganizationGroup[];
  teams: DistrictTeamCard[];
}

const AVAILABILITY_RANK: Record<string, number> = {
  AVAILABLE: 0,
  ON_DEPLOYMENT: 1,
  UNAVAILABLE: 2,
};

function availabilityRank(value: string): number {
  return AVAILABILITY_RANK[value] ?? 3;
}

function toTeamCard(
  row: DeployableTeamRow,
  homeDistrict: string | null
): DistrictTeamCard {
  const isOrganization = row.affiliation === "ORGANIZATION";

  return {
    userId: row.user_id,
    teamName: row.team_name,
    teamType: row.team_type,
    district: row.operating_district,
    outsideDistrict: Boolean(
      homeDistrict && row.operating_district !== homeDistrict
    ),
    availability: row.availability ?? "UNAVAILABLE",
    members: row.member_count,
    contactNumber: row.team_contact_number ?? row.leader_phone_number,
    capabilities: row.capabilities ?? [],
    equipment: row.equipment ?? [],
    leader: {
      fullName: row.leader_full_name,
      designation: row.leader_designation,
      email: row.leader_email,
      phone: row.leader_phone_number,
    },
    base: {
      latitude: row.base_latitude,
      longitude: row.base_longitude,
      label: row.base_location_label,
    },
    organization:
      isOrganization && row.organization_name
        ? {
            name: row.organization_name,
            registrationId: row.organization_registration_number ?? "—",
          }
        : null,
    affiliation: row.affiliation,
    verifiedBy: row.verified_by,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
  };
}

function summarizeDisasters(
  cards: DistrictTeamCard[]
): DistrictDisasterGroup[] {
  return RESCUE_TEAM_TYPES.map((type) => {
    const matched = cards.filter((card) => card.teamType === type);

    return {
      type,
      teams: matched.length,
      available: matched.filter((card) => card.availability === "AVAILABLE")
        .length,
      members: matched.reduce((total, card) => total + card.members, 0),
    };
  }).filter((group) => group.teams > 0);
}

/**
 * The board a District Officer tasking teams needs: every approved team, split
 * by disaster type and by the organization it belongs to. By default the
 * officer only sees their own district; the mutual-aid scope adds verified teams
 * from other districts, flagged so nobody mistakes them for local capacity.
 */
export async function getDistrictRescueBoard(
  userId: string,
  scope: string
): Promise<DistrictRescueBoard> {
  const assignment = await findOfficerAssignment(userId);

  if (!assignment) {
    throw new ApiError(
      404,
      "No district officer profile is linked to this account."
    );
  }

  const homeDistrict = assignment.district?.trim() || null;

  // An officer with no assigned district (a DMC duty officer, say) has no local
  // board to fall back on, so that account always reads every district.
  const mutualAid = String(scope ?? "").trim().toLowerCase() === "all" || !homeDistrict;

  const rows = await listDeployableTeams(mutualAid ? null : homeDistrict);

  const teams = rows
    .map((row) => toTeamCard(row, homeDistrict))
    .sort(
      (a, b) =>
        availabilityRank(a.availability) - availabilityRank(b.availability) ||
        a.district.localeCompare(b.district) ||
        a.teamName.localeCompare(b.teamName)
    );

  const groups = new Map<string, DistrictOrganizationGroup>();

  for (const card of teams) {
    const key = card.organization
      ? `ORG:${card.organization.registrationId}`
      : `IND:${card.district}`;

    let group = groups.get(key);

    if (!group) {
      group = {
        key,
        name: card.organization
          ? card.organization.name
          : `Independent / community teams · ${card.district}`,
        registrationId: card.organization?.registrationId ?? null,
        kind: card.organization ? "ORGANIZATION" : "INDEPENDENT",
        districts: [],
        teams: 0,
        available: 0,
        members: 0,
        disasters: [],
        teamCards: [],
      };
      groups.set(key, group);
    }

    if (!group.districts.includes(card.district)) {
      group.districts.push(card.district);
    }

    group.teams += 1;
    group.members += card.members;

    if (card.availability === "AVAILABLE") group.available += 1;

    group.teamCards.push(card);
  }

  const organizations = [...groups.values()]
    .map((group) => ({ ...group, disasters: summarizeDisasters(group.teamCards) }))
    .sort(
      (a, b) =>
        b.available - a.available ||
        b.teams - a.teams ||
        a.name.localeCompare(b.name)
    );

  return {
    officer: {
      fullName: assignment.full_name,
      district: homeDistrict,
      clearanceLevel: assignment.clearance_level,
      scope: mutualAid ? "mutual-aid" : "district",
    },
    summary: {
      teams: teams.length,
      available: teams.filter((card) => card.availability === "AVAILABLE").length,
      onDeployment: teams.filter((card) => card.availability === "ON_DEPLOYMENT")
        .length,
      standingDown: teams.filter((card) => card.availability !== "AVAILABLE" && card.availability !== "ON_DEPLOYMENT")
        .length,
      members: teams.reduce((total, card) => total + card.members, 0),
      organizations: organizations.filter((group) => group.kind === "ORGANIZATION")
        .length,
      disasters: summarizeDisasters(teams).length,
      districts: new Set(teams.map((card) => card.district)).size,
    },
    disasters: summarizeDisasters(teams),
    organizations,
    teams,
  };
}
