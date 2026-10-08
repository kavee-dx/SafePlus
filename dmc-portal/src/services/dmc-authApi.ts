import api from "./api";
import type { AuthUser, UserRole } from "../types/auth";

export interface DmcLoginRequest {
  email: string;
  password: string;
  interface: "DMC_PORTAL";
}

export interface DmcLoginResponse {
  message: string;
  token: string;
  account: {
    id: string;
    fullName: string;
    email: string;
    username: string | null;
    role: string;
    status: string;
    interfaces: readonly string[];
  };
}

export async function loginDmcOfficer(
  credentials: DmcLoginRequest
): Promise<{ token: string; user: AuthUser }> {
  const response = await api.post<DmcLoginResponse>(
    "/auth/login",
    credentials
  );

  const { token, account } = response.data;

  const user: AuthUser = {
    id: account.id,
    fullName: account.fullName,
    email: account.email,
    role: account.role as UserRole,
    status: account.status,
  };

  // Store token in localStorage
  localStorage.setItem("dmc_token", token);
  localStorage.setItem("dmc_user", JSON.stringify(user));

  return { token, user };
}

export function getStoredDmcToken(): string | null {
  return localStorage.getItem("dmc_token");
}

export function getStoredDmcUser(): AuthUser | null {
  const userStr = localStorage.getItem("dmc_user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function clearDmcAuth(): void {
  localStorage.removeItem("dmc_token");
  localStorage.removeItem("dmc_user");
}
