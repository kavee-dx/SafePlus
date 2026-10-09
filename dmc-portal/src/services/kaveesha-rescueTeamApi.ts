import axios from "axios";

import api from "./api";
import type { VerifiedOrganization } from "../constants/kaveesha-rescueTeamOptions";
import type { FieldErrors } from "../utils/dushani-registrationValidation";

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

export class RescueTeamApiError extends Error {
  readonly status: number | null;
  readonly fieldErrors: FieldErrors;

  constructor(
    message: string,
    status: number | null,
    fieldErrors: FieldErrors = {}
  ) {
    super(message);
    this.name = "RescueTeamApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function toTeamError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new RescueTeamApiError(
        "Cannot reach the server. Check that the backend is running and try again.",
        null
      );
    }

    const body = error.response.data as {
      message?: string;
      errors?: FieldErrors;
    };

    return new RescueTeamApiError(
      body?.message || "Something went wrong. Please try again.",
      error.response.status,
      body?.errors ?? {}
    );
  }

  return error instanceof Error ? error : new Error("Something went wrong.");
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * The registration form may only offer organizations a Super Admin has already
 * verified, so the list is fetched from the public rescue team endpoint.
 */
export async function fetchVerifiedOrganizations(): Promise<
  VerifiedOrganization[]
> {
  try {
    const { data } = await api.get("/rescue-teams/organizations");

    return (data.data ?? []) as VerifiedOrganization[];
  } catch (error) {
    throw toTeamError(error);
  }
}

export async function fetchTeamLeaderDashboard(
  token: string
): Promise<RescueTeamDashboard> {
  try {
    const { data } = await api.get("/rescue-teams/dashboard", {
      headers: authHeaders(token),
    });

    return data.data as RescueTeamDashboard;
  } catch (error) {
    throw toTeamError(error);
  }
}

export async function resubmitRescueTeam(
  token: string,
  payload: Record<string, string>
): Promise<{ message: string; dashboard: RescueTeamDashboard }> {
  try {
    const { data } = await api.post("/rescue-teams/resubmit", payload, {
      headers: authHeaders(token),
    });

    return {
      message: String(data.message ?? ""),
      dashboard: data.data as RescueTeamDashboard,
    };
  } catch (error) {
    throw toTeamError(error);
  }
}

export async function updateTeamAvailability(
  token: string,
  availability: string
): Promise<RescueTeamDashboard> {
  try {
    const { data } = await api.put(
      "/rescue-teams/availability",
      { availability },
      { headers: authHeaders(token) }
    );

    return data.data as RescueTeamDashboard;
  } catch (error) {
    throw toTeamError(error);
  }
}
