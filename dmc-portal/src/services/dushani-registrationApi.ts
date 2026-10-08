import axios from "axios";

import api from "./api";
import type { FieldErrors } from "../utils/dushani-registrationValidation";

export interface RegisteredAccount {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  role: string;
  status: "ACTIVE" | "PENDING_VERIFICATION";
}

export class RegistrationApiError extends Error {
  status: number | null;
  fieldErrors: FieldErrors;

  constructor(
    message: string,
    status: number | null,
    fieldErrors: FieldErrors = {}
  ) {
    super(message);
    this.name = "RegistrationApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function registerAccount(
  type: string,
  payload: Record<string, string>
): Promise<RegisteredAccount> {
  try {
    const { data } = await api.post(`/registrations/${type}`, payload);

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
