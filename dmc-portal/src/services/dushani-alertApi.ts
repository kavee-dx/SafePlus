import axios, { AxiosError } from "axios";

import { getStoredDmcToken } from "./dmc-authApi";
import type {
  AudiencePreview,
  Coordinate,
  CreateDraftRequest,
  DisasterWarning,
  DistrictBoundary,
  DistrictCoverage,
} from "../types/warning";
import type {
  HazardReport,
  PortalNotification,
  SeverityLevel,
} from "../types/hazardReport";

/**
 * A dedicated instance rather than an interceptor on the shared client, so the
 * officer token never leaks into a teammate's registration or admin request.
 */
const alertApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

alertApi.interceptors.request.use((config) => {
  const token = getStoredDmcToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export class AlertApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string>) {
    super(message);
    this.name = "AlertApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function unwrap(error: unknown): never {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | { message?: string; errors?: Record<string, string> }
      | undefined;

    throw new AlertApiError(
      error.response?.status ?? 500,
      data?.message ?? "The server could not complete that action.",
      data?.errors ?? {}
    );
  }

  throw error;
}

export interface PinStatus {
  isOfficer: boolean;
  hasPin: boolean;
  pinUpdatedAt?: string;
}

export async function fetchDistricts(): Promise<DistrictBoundary[]> {
  const response = await alertApi
    .get<{ districts: DistrictBoundary[] }>("/geo/districts")
    .catch(unwrap);

  return response.data.districts;
}

export async function fetchDistrictRings(
  district: string
): Promise<Coordinate[][]> {
  const response = await alertApi
    .get<{ rings: Coordinate[][] }>(
      `/geo/districts/${encodeURIComponent(district)}/boundary`
    )
    .catch(unwrap);

  return response.data.rings;
}

export async function resolveDistrictAt(
  lat: number,
  lng: number
): Promise<string | null> {
  const response = await alertApi
    .post<{ district: string | null }>("/geo/resolve", { lat, lng })
    .catch(unwrap);

  return response.data.district;
}

export async function fetchPendingReports(
  district?: string
): Promise<HazardReport[]> {
  const query = district ? `?district=${encodeURIComponent(district)}` : "";
  const response = await alertApi
    .get<{ reports: HazardReport[] }>(`/reports/pending${query}`)
    .catch(unwrap);

  return response.data.reports;
}

export async function fetchVerifiedReports(): Promise<HazardReport[]> {
  const response = await alertApi
    .get<{ reports: HazardReport[] }>("/reports/verified")
    .catch(unwrap);

  return response.data.reports;
}

export async function fetchReport(reportId: string): Promise<HazardReport> {
  const response = await alertApi
    .get<{ report: HazardReport }>(`/reports/${encodeURIComponent(reportId)}`)
    .catch(unwrap);

  return response.data.report;
}

export async function verifyReport(
  reportId: string,
  decision: "VERIFIED" | "REJECTED",
  verificationNotes?: string
): Promise<HazardReport> {
  const response = await alertApi
    .put<{ message: string; report: HazardReport }>(
      `/reports/${encodeURIComponent(reportId)}/verify`,
      { status: decision, verificationNotes }
    )
    .catch(unwrap);

  return response.data.report;
}

export async function fetchNotifications(): Promise<{
  notifications: PortalNotification[];
  unreadCount: number;
}> {
  const response = await alertApi
    .get<{ notifications: PortalNotification[]; unreadCount: number }>(
      "/notifications"
    )
    .catch(unwrap);

  return {
    notifications: response.data.notifications,
    unreadCount: response.data.unreadCount,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await alertApi.put(`/notifications/${encodeURIComponent(id)}/read`).catch(unwrap);
}

export async function fetchPinStatus(): Promise<PinStatus> {
  const response = await alertApi
    .get<PinStatus>("/clearance-pin")
    .catch(unwrap);

  return response.data;
}

export async function setPin(
  pin: string,
  currentPin?: string
): Promise<{ message: string }> {
  const response = await alertApi
    .put<{ message: string }>("/clearance-pin", { pin, currentPin })
    .catch(unwrap);

  return response.data;
}

export async function createDraft(
  data: CreateDraftRequest
): Promise<DisasterWarning> {
  const response = await alertApi
    .post<{ message: string; warning: DisasterWarning }>("/warnings/draft", data)
    .catch(unwrap);

  return response.data.warning;
}

export async function updateDraft(
  warningId: string,
  data: Partial<CreateDraftRequest>
): Promise<DisasterWarning> {
  const response = await alertApi
    .put<{ message: string; warning: DisasterWarning }>(
      `/warnings/${encodeURIComponent(warningId)}/draft`,
      data
    )
    .catch(unwrap);

  return response.data.warning;
}

export async function deleteDraft(warningId: string): Promise<void> {
  await alertApi
    .delete(`/warnings/${encodeURIComponent(warningId)}/draft`)
    .catch(unwrap);
}

export async function previewAudience(
  targetDistrict: string,
  customBoundary?: Coordinate[]
): Promise<AudiencePreview> {
  const response = await alertApi
    .post<{ audience: AudiencePreview }>("/warnings/audience", {
      targetDistrict,
      customBoundary,
    })
    .catch(unwrap);

  return response.data.audience;
}

export async function broadcastWarning(
  warningId: string,
  securityPin: string
): Promise<DisasterWarning> {
  const response = await alertApi
    .post<{ message: string; warning: DisasterWarning }>("/warnings/broadcast", {
      warningId,
      securityPin,
    })
    .catch(unwrap);

  return response.data.warning;
}

export async function standDownWarning(
  warningId: string
): Promise<DisasterWarning> {
  const response = await alertApi
    .post<{ message: string; warning: DisasterWarning }>(
      `/warnings/${encodeURIComponent(warningId)}/stand-down`
    )
    .catch(unwrap);

  return response.data.warning;
}

export async function fetchWarnings(): Promise<DisasterWarning[]> {
  const response = await alertApi
    .get<{ warnings: DisasterWarning[] }>("/warnings")
    .catch(unwrap);

  return response.data.warnings;
}

export async function fetchWarning(warningId: string): Promise<DisasterWarning> {
  const response = await alertApi
    .get<{ warning: DisasterWarning }>(
      `/warnings/${encodeURIComponent(warningId)}`
    )
    .catch(unwrap);

  return response.data.warning;
}

export interface CoverageResponse {
  totalAlertedAccounts: number;
  byDistrict: DistrictCoverage[];
}

export async function fetchCoverage(): Promise<CoverageResponse> {
  const response = await alertApi
    .get<CoverageResponse>("/warnings/coverage")
    .catch(unwrap);

  return response.data;
}

export async function synthesizeMessages(data: {
  hazardType: string;
  severityLevel: SeverityLevel;
  targetDistrict: string;
  safetyInstructions?: string;
}): Promise<{ english: string; sinhala: string; tamil: string }> {
  const response = await alertApi
    .post<{ messages: { english: string; sinhala: string; tamil: string } }>(
      "/warnings/message-preview",
      data
    )
    .catch(unwrap);

  return response.data.messages;
}
