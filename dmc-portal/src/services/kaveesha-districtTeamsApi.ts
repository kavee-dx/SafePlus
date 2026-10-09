import axios from "axios";

import api from "./api";

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

export type BoardScope = "district" | "all";

export class DistrictTeamsApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "DistrictTeamsApiError";
    this.status = status;
  }
}

function toBoardError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new DistrictTeamsApiError(
        "Cannot reach the server. Check that the backend is running and try again.",
        null
      );
    }

    const body = error.response.data as { message?: string };

    return new DistrictTeamsApiError(
      body?.message || "The rescue team board could not be loaded.",
      error.response.status
    );
  }

  return error instanceof Error ? error : new Error("Something went wrong.");
}

/**
 * Approved teams the signed-in officer may task. The district scope is the
 * officer's own assignment; "all" adds verified teams from other districts as
 * mutual aid, which the server marks on each team.
 */
export async function fetchDistrictRescueBoard(
  token: string,
  scope: BoardScope
): Promise<DistrictRescueBoard> {
  try {
    const { data } = await api.get("/rescue-teams/district-board", {
      params: { scope },
      headers: { Authorization: `Bearer ${token}` },
    });

    return data.data as DistrictRescueBoard;
  } catch (error) {
    throw toBoardError(error);
  }
}
