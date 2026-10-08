import axios, { AxiosError } from "axios";

import { getStoredDmcToken } from "./dmc-authApi";
import { AlertApiError } from "./dushani-alertApi";

/**
 * UC-02 report endpoints added under /api/reports. Verification and rejection
 * still go through the existing verifyReport() in dushani-alertApi so there is
 * one gate that unlocks warning creation.
 */
const reportApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

reportApi.interceptors.request.use((config) => {
  const token = getStoredDmcToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

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

export type ExtendedReportStatus =
  | "PENDING_VERIFICATION"
  | "ADDITIONAL_INFO_REQUIRED"
  | "VERIFIED"
  | "REJECTED"
  | "RESOLVED";

export type SeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface EvidenceAttachment {
  id: string;
  reportId: string;
  fileUrl: string;
  fileKind: "PHOTO" | "VIDEO";
  contentType?: string;
  createdAt?: string;
}

export interface ExtendedReport {
  id: string;
  reportId: string;
  reporterId?: string;
  reporterName?: string;
  reporterPhone?: string;
  hazardType: string;
  severityLevel: SeverityLevel;
  locationDistrict: string;
  locationLat?: number;
  locationLng?: number;
  landmark?: string;
  description: string;
  affectedPopulation?: number;
  immediateDanger: boolean;
  observedAt?: string;
  status: ExtendedReportStatus;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  infoRequestReason?: string;
  infoRequestedAt?: string;
  warningCount?: number;
  attachments: EvidenceAttachment[];
  createdAt: string;
  updatedAt: string;
}

async function list(path: string, district?: string): Promise<ExtendedReport[]> {
  const query = district ? `?district=${encodeURIComponent(district)}` : "";
  const response = await reportApi
    .get<{ reports: ExtendedReport[] }>(`${path}${query}`)
    .catch(unwrap);

  return response.data.reports;
}

export function fetchQueuePending(district?: string): Promise<ExtendedReport[]> {
  return list("/reports/queue/pending", district);
}

export function fetchQueueInfoRequired(district?: string): Promise<ExtendedReport[]> {
  return list("/reports/queue/info-required", district);
}

export function fetchQueueVerified(): Promise<ExtendedReport[]> {
  return list("/reports/queue/verified");
}

export function fetchQueueRejected(): Promise<ExtendedReport[]> {
  return list("/reports/queue/rejected");
}

/** `id` is the internal uuid; the queue endpoints resolve details with it. */
export async function fetchQueueReport(id: string): Promise<ExtendedReport> {
  const response = await reportApi
    .get<{ report: ExtendedReport }>(`/reports/queue/${encodeURIComponent(id)}`)
    .catch(unwrap);

  return response.data.report;
}

/** A2: send the report back to the citizen for more information. */
export async function requestMoreInfo(
  id: string,
  reason: string
): Promise<ExtendedReport> {
  const response = await reportApi
    .put<{ message: string; report: ExtendedReport }>(
      `/reports/queue/${encodeURIComponent(id)}/request-info`,
      { reason }
    )
    .catch(unwrap);

  return response.data.report;
}
