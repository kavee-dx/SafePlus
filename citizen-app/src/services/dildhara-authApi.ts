import axios from "axios";

import type { FieldErrors } from "../utils/dushani-registrationValidation";

export type InterfaceAccess = "MOBILE_APP" | "DMC_PORTAL";

export interface LoginAccount {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  role: string;
  status: string;
  interfaces: InterfaceAccess[];
}

export interface LoginResult {
  token: string;
  account: LoginAccount;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly fieldErrors: FieldErrors = {}
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:5000/api";

const http = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

export async function loginAccount(
  email: string,
  password: string,
  appInterface: InterfaceAccess = "MOBILE_APP"
): Promise<LoginResult> {
  try {
    const { data } = await http.post("/auth/login", {
      email,
      password,
      interface: appInterface,
    });

    return { token: data.token, account: data.account };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        throw new AuthApiError(
          "Cannot reach the server. Check your connection and try again.",
          null
        );
      }

      const body = error.response.data as {
        message?: string;
        errors?: FieldErrors;
      };

      throw new AuthApiError(
        body?.message || "Something went wrong. Please try again.",
        error.response.status,
        body?.errors ?? {}
      );
    }

    throw error;
  }
}