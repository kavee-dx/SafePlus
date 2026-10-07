import axios from "axios";

import { AuthApiError } from "./dildhara-authApi";

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

export async function fetchMyProfile(token: string): Promise<Profile> {
  try {
    const { data } = await axios.get(`${BASE_URL}/profile/me`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });

    return data as Profile;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        throw new AuthApiError(
          "Cannot reach the server. Check your connection and try again.",
          null
        );
      }

      throw new AuthApiError(
        (error.response.data as { message?: string })?.message ||
          "Could not load your profile.",
        error.response.status
      );
    }

    throw error;
  }
}