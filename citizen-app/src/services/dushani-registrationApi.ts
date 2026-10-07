import axios from "axios";

import type { FieldErrors } from "../utils/dushani-registrationValidation";

export type RegistrationType =
  | "citizen"
  | "delivery-volunteer"
  | "delivery-volunteer-team"
  | "food-donor"
  | "relief-agency"
  | "organization-team-leader"
  | "independent-team-leader";

export type InterfaceAccess = "MOBILE_APP" | "DMC_PORTAL";

export interface RegisteredAccount {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  role: string;
  status: "ACTIVE" | "PENDING_VERIFICATION";
  verifiedBy: "SUPER_ADMIN" | "ORGANIZATION_ADMIN" | null;
  interfaces: InterfaceAccess[];
}

export class RegistrationApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly fieldErrors: FieldErrors = {}
  ) {
    super(message);
    this.name = "RegistrationApiError";
  }
}

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:5000/api";

const http = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

export async function registerAccount(
  type: RegistrationType,
  payload: Record<string, string>
): Promise<RegisteredAccount> {
  try {
    const { data } = await http.post(`/registrations/${type}`, payload);

    return data.account as RegisteredAccount;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        throw new RegistrationApiError(
          "Cannot reach the registration server. Check that the backend is running and try again.",
          null
        );
      }

      const body = error.response.data as {
        message?: string;
        errors?: FieldErrors;
      };

      throw new RegistrationApiError(
        body?.message || "Something went wrong. Please try again.",
        error.response.status,
        body?.errors ?? {}
      );
    }

    throw error;
  }
}
