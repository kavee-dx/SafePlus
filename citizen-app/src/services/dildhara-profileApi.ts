import axios from "axios";

import { AuthApiError } from "./dildhara-authApi";
import type { FieldErrors } from "../utils/dushani-registrationValidation";

export interface ProfileUser {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  phoneNumber: string | null;
  nicNumber: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  postalCode: string | null;
  role: string;
  status: string;
}

export type ProfileDetails = Record<string, string | number | boolean | null>;

export interface Profile {
  user: ProfileUser;
  details: ProfileDetails | null;
}

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:5000/api";

function toApiError(error: unknown, fallback: string): unknown {
  if (!axios.isAxiosError(error)) return error;

  if (!error.response) {
    return new AuthApiError(
      "Cannot reach the server. Check your connection and try again.",
      null
    );
  }

  const body = error.response.data as {
    message?: string;
    errors?: FieldErrors;
  };

  return new AuthApiError(
    body?.message || fallback,
    error.response.status,
    body?.errors ?? {}
  );
}

const authHeader = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
  timeout: 15000,
});

export async function fetchMyProfile(token: string): Promise<Profile> {
  try {
    const { data } = await axios.get(
      `${BASE_URL}/profile/me`,
      authHeader(token)
    );
    return { user: data.user, details: data.details };
  } catch (error) {
    throw toApiError(error, "Could not load your profile.");
  }
}

export async function updateMyProfile(
  token: string,
  changes: Record<string, string>
): Promise<Profile> {
  try {
    const { data } = await axios.patch(
      `${BASE_URL}/profile/me`,
      changes,
      authHeader(token)
    );
    return { user: data.user, details: data.details };
  } catch (error) {
    throw toApiError(error, "Could not save your changes.");
  }
}