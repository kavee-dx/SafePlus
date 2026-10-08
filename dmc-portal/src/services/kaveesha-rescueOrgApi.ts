import axios from "axios";

import api from "./api";

export interface RescueTeam {
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
  teams: RescueTeam[];
  stats: {
    totalTeams: number;
    activeTeams: number;
    pendingTeams: number;
    rejectedTeams: number;
    availableTeams: number;
    totalMembers: number;
  };
}

export class RescueOrgApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "RescueOrgApiError";
    this.status = status;
  }
}

function toRescueOrgError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new RescueOrgApiError(
        "Cannot reach the server. Check that the backend is running and try again.",
        null
      );
    }

    const body = error.response.data as { message?: string };

    return new RescueOrgApiError(
      body?.message || "Something went wrong. Please try again.",
      error.response.status
    );
  }

  return error instanceof Error ? error : new Error("Something went wrong.");
}

export async function fetchRescueOrganizationDashboard(
  token: string
): Promise<RescueOrganizationDashboard> {
  try {
    const { data } = await api.get("/rescue-organization/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    });

    return data.data as RescueOrganizationDashboard;
  } catch (error) {
    throw toRescueOrgError(error);
  }
}

/**
 * The organization admin verifies a rescue team that registered itself under
 * this organization's registration ID.
 */
export async function approveRescueTeam(
  token: string,
  teamUserId: string
): Promise<{ message: string; team: RescueTeam }> {
  try {
    const { data } = await api.post(
      `/rescue-organization/teams/${teamUserId}/approve`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return {
      message: String(data.message ?? "Team verified."),
      team: data.data as RescueTeam,
    };
  } catch (error) {
    throw toRescueOrgError(error);
  }
}

export async function rejectRescueTeam(
  token: string,
  teamUserId: string,
  reason: string
): Promise<{ message: string; team: RescueTeam }> {
  try {
    const { data } = await api.post(
      `/rescue-organization/teams/${teamUserId}/reject`,
      { reason },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return {
      message: String(data.message ?? "Team rejected."),
      team: data.data as RescueTeam,
    };
  } catch (error) {
    throw toRescueOrgError(error);
  }
}
