import axios from "axios";

import api from "./api";
import type { FieldErrors } from "../utils/dushani-registrationValidation";

export const PORTAL_ROLE_LABELS: Record<string, string> = {
  DMC_OFFICER: "DMC Officer",
  DISTRICT_OFFICER: "District Officer",
  COORDINATOR: "Relief Operations Coordinator",
  ORGANIZATION_ADMIN: "Organization Admin",
};

export interface PortalAccount {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  role: string;
  status: string;
  interfaces: string[];
}

export interface PortalSession {
  token: string;
  account: PortalAccount;
}

type Value = string | number | boolean | null;

export interface PortalProfile {
  user: Record<string, Value>;
  details: Record<string, Value> | null;
}

export class PortalApiError extends Error {
  readonly status: number | null;
  readonly fieldErrors: FieldErrors;

  constructor(
    message: string,
    status: number | null,
    fieldErrors: FieldErrors = {}
  ) {
    super(message);
    this.name = "PortalApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function toPortalError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new PortalApiError(
        "Cannot reach the server. Check that the backend is running and try again.",
        null
      );
    }

    const body = error.response.data as {
      message?: string;
      errors?: FieldErrors;
    };

    return new PortalApiError(
      body?.message || "Something went wrong. Please try again.",
      error.response.status,
      body?.errors ?? {}
    );
  }

  return error instanceof Error ? error : new Error("Something went wrong.");
}

const authHeader = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export async function portalLogin(
  email: string,
  password: string
): Promise<PortalSession> {
  try {
    const { data } = await api.post("/auth/login", {
      email,
      password,
      interface: "DMC_PORTAL",
    });

    return { token: data.token, account: data.account };
  } catch (error) {
    throw toPortalError(error);
  }
}

export async function fetchPortalProfile(
  token: string
): Promise<PortalProfile> {
  try {
    const { data } = await api.get("/profile/me", authHeader(token));
    return { user: data.user, details: data.details };
  } catch (error) {
    throw toPortalError(error);
  }
}

export async function updatePortalProfile(
  token: string,
  changes: Record<string, string>
): Promise<PortalProfile> {
  try {
    const { data } = await api.patch("/profile/me", changes, authHeader(token));
    return { user: data.user, details: data.details };
  } catch (error) {
    throw toPortalError(error);
  }
}