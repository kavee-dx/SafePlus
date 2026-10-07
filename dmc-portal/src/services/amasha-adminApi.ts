import axios from "axios";

import api from "./api";
import type { AdminUser } from "../types/auth";

export type AccountStatus =
  | "ACTIVE"
  | "PENDING_VERIFICATION"
  | "REJECTED"
  | "SUSPENDED";

export type ReviewableRole =
  | "DISTRICT_OFFICER"
  | "DMC_OFFICER"
  | "COORDINATOR"
  | "RELIEF_AGENCY"
  | "ORGANIZATION_ADMIN"
  | "INDEPENDENT_TEAM_LEADER";

export interface ProfileField {
  label: string;
  value: string;
}

export interface RegistrationRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: ReviewableRole;
  status: AccountStatus;
  district: string | null;
  rejectionReason: string | null;
  createdAt: string;
  verifiedAt: string | null;
  profile: ProfileField[];
}

export interface AdminStats {
  pending: number;
  active: number;
  rejected: number;
  suspended: number;
  total: number;
}

export class AdminApiError extends Error {
  status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

const TOKEN_KEY = "safeplus.admin.token";
const ADMIN_KEY = "safeplus.admin.user";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredAdmin(): AdminUser | null {
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

function storeSession(token: string, admin: AdminUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
  delete api.defaults.headers.common.Authorization;
}

// Attach any existing token on module load so a page refresh keeps the session.
const existingToken = getStoredToken();
if (existingToken) {
  api.defaults.headers.common.Authorization = `Bearer ${existingToken}`;
}

function toError(error: unknown): AdminApiError {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new AdminApiError(
        "Cannot reach the SafePlus server. Check that the backend is running.",
        null
      );
    }
    const body = error.response.data as { message?: string };
    return new AdminApiError(
      body?.message || "Something went wrong. Please try again.",
      error.response.status
    );
  }
  return new AdminApiError("Something went wrong. Please try again.", null);
}

export async function adminLogin(
  email: string,
  password: string
): Promise<AdminUser> {
  try {
    const { data } = await api.post<{
      token: string;
      admin: AdminUser;
    }>("/admin/login", { email, password });

    storeSession(data.token, data.admin);
    return data.admin;
  } catch (error) {
    throw toError(error);
  }
}

export async function fetchRegistrations(filters: {
  status?: AccountStatus | "ALL";
  role?: ReviewableRole | "ALL";
}): Promise<RegistrationRecord[]> {
  try {
    const { data } = await api.get<{ registrations: RegistrationRecord[] }>(
      "/admin/registrations",
      { params: filters }
    );
    return data.registrations;
  } catch (error) {
    throw toError(error);
  }
}

export async function fetchStats(): Promise<AdminStats> {
  try {
    const { data } = await api.get<{ stats: AdminStats }>("/admin/stats");
    return data.stats;
  } catch (error) {
    throw toError(error);
  }
}

export async function approveRegistration(
  id: string
): Promise<RegistrationRecord> {
  try {
    const { data } = await api.post<{ registration: RegistrationRecord }>(
      `/admin/registrations/${id}/approve`
    );
    return data.registration;
  } catch (error) {
    throw toError(error);
  }
}

export async function rejectRegistration(
  id: string,
  reason: string
): Promise<RegistrationRecord> {
  try {
    const { data } = await api.post<{ registration: RegistrationRecord }>(
      `/admin/registrations/${id}/reject`,
      { reason }
    );
    return data.registration;
  } catch (error) {
    throw toError(error);
  }
}
