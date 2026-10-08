import { ApiError } from "../utils/apiError";
import {
  findRescueOrganizationByUserId,
  findTeamForReview,
  findTeamsByRegistrationNumber,
  setTeamReviewOutcome,
  type RescueTeamRow,
} from "../repositories/kaveesha-rescueOrgRepository";
import { sendVerificationResultEmail } from "./amasha-emailService";

export interface RescueTeamSummary {
  userId: string;
  teamName: string;
  teamType: string;
  leaderFullName: string;
  leaderDesignation: string | null;
  leaderEmail: string;
  leaderPhone: string;
  teamContactNumber: string;
  operatingDistrict: string;
  memberCount: number;
  capabilities: string[];
  equipment: string[];
  base: {
    latitude: number | null;
    longitude: number | null;
    label: string | null;
  };
  availability: string;
  affiliation: string;
  status: string;
  rejectionReason: string | null;
  registeredAt: string;
  reviewedAt: string | null;
}

export interface RescueOrganizationDashboard {
  organization: {
    name: string;
    type: string;
    registrationId: string;
    district: string;
    address: string;
    officialEmail: string;
    officialPhone: string;
  };
  admin: {
    fullName: string;
    designation: string;
    email: string;
    phone: string;
  };
  account: {
    status: string;
    verifiedAt: string | null;
    registeredAt: string;
  };
  teams: RescueTeamSummary[];
  stats: {
    totalTeams: number;
    activeTeams: number;
    pendingTeams: number;
    rejectedTeams: number;
    availableTeams: number;
    totalMembers: number;
  };
}

function toTeamSummary(row: RescueTeamRow): RescueTeamSummary {
  return {
    userId: row.user_id,
    teamName: row.team_name,
    teamType: row.team_type ?? "—",
    leaderFullName: row.leader_full_name,
    leaderDesignation: row.leader_designation,
    leaderEmail: row.leader_email,
    leaderPhone: row.leader_phone_number,
    teamContactNumber: row.team_contact_number ?? row.leader_phone_number,
    operatingDistrict: row.operating_district,
    memberCount: row.member_count,
    capabilities: row.capabilities ?? [],
    equipment: row.equipment ?? [],
    base: {
      latitude: row.base_latitude,
      longitude: row.base_longitude,
      label: row.base_location_label,
    },
    availability: row.availability ?? "UNAVAILABLE",
    affiliation: row.affiliation,
    status: row.account_status,
    rejectionReason: row.rejection_reason,
    registeredAt: new Date(row.created_at).toISOString(),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
  };
}

async function requireOrganization(userId: string) {
  const organization = await findRescueOrganizationByUserId(userId);

  if (!organization) {
    throw new ApiError(
      404,
      "No rescue organization profile is linked to this account."
    );
  }

  return organization;
}

export async function getRescueOrganizationDashboard(
  userId: string
): Promise<RescueOrganizationDashboard> {
  const organization = await requireOrganization(userId);

  const teams = await findTeamsByRegistrationNumber(
    organization.registration_number
  );

  const summaries = teams.map(toTeamSummary);

  return {
    organization: {
      name: organization.organization_name,
      type: organization.organization_type,
      registrationId: organization.registration_number,
      district: organization.district,
      address: organization.address,
      officialEmail: organization.official_email,
      officialPhone: organization.official_phone,
    },
    admin: {
      fullName: organization.admin_full_name,
      designation: organization.admin_designation,
      email: organization.admin_email,
      phone: organization.admin_phone,
    },
    account: {
      status: organization.account_status,
      verifiedAt: organization.verified_at
        ? new Date(organization.verified_at).toISOString()
        : null,
      registeredAt: new Date(organization.created_at).toISOString(),
    },
    teams: summaries,
    stats: {
      totalTeams: summaries.length,
      activeTeams: summaries.filter((team) => team.status === "ACTIVE").length,
      pendingTeams: summaries.filter(
        (team) => team.status === "PENDING_VERIFICATION"
      ).length,
      rejectedTeams: summaries.filter(
        (team) => team.status === "REJECTED"
      ).length,
      availableTeams: summaries.filter(
        (team) =>
          team.status === "ACTIVE" && team.availability === "AVAILABLE"
      ).length,
      totalMembers: summaries.reduce(
        (total, team) => total + team.memberCount,
        0
      ),
    },
  };
}

/** The organization admin approves a team waiting in their own queue. */
export async function approveRescueTeam(
  organizationAdminUserId: string,
  teamUserId: string
): Promise<RescueTeamSummary> {
  const organization = await requireOrganization(organizationAdminUserId);

  const team = await findTeamForReview(
    teamUserId,
    organization.registration_number
  );

  if (!team) {
    throw new ApiError(
      404,
      "That team is not registered under your organization."
    );
  }

  if (team.account_status !== "PENDING_VERIFICATION") {
    throw new ApiError(
      409,
      `This team is already ${team.account_status.toLowerCase().replace("_", " ")}.`
    );
  }

  await setTeamReviewOutcome(teamUserId, "ACTIVE", {
    rejectionReason: null,
    reviewerUserId: organizationAdminUserId,
  });

  await sendVerificationResultEmail({
    to: team.leader_email,
    fullName: team.leader_full_name,
    role: "ORGANIZATION_TEAM_LEADER",
    approved: true,
    reviewer: `${organization.organization_name} organization admin`,
  });

  const reviewed = await findTeamForReview(
    teamUserId,
    organization.registration_number
  );

  return toTeamSummary(reviewed ?? team);
}

/** A rejection keeps the reason on the account so the leader can fix and resubmit. */
export async function rejectRescueTeam(
  organizationAdminUserId: string,
  teamUserId: string,
  reason: string
): Promise<RescueTeamSummary> {
  const trimmedReason = String(reason || "").trim();

  if (trimmedReason.length < 5) {
    throw new ApiError(
      400,
      "Please provide a rejection reason (at least 5 characters)."
    );
  }

  const organization = await requireOrganization(organizationAdminUserId);

  const team = await findTeamForReview(
    teamUserId,
    organization.registration_number
  );

  if (!team) {
    throw new ApiError(
      404,
      "That team is not registered under your organization."
    );
  }

  if (team.account_status === "REJECTED") {
    throw new ApiError(409, "This team is already rejected.");
  }

  await setTeamReviewOutcome(teamUserId, "REJECTED", {
    rejectionReason: trimmedReason,
    reviewerUserId: organizationAdminUserId,
  });

  await sendVerificationResultEmail({
    to: team.leader_email,
    fullName: team.leader_full_name,
    role: "ORGANIZATION_TEAM_LEADER",
    approved: false,
    reason: trimmedReason,
    reviewer: `${organization.organization_name} organization admin`,
  });

  const reviewed = await findTeamForReview(
    teamUserId,
    organization.registration_number
  );

  return toTeamSummary(reviewed ?? team);
}
