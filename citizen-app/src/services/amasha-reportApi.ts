import axios, { type AxiosRequestConfig } from "axios";

import { AlertApiError } from "./dushani-alertApi";
import type { FieldErrors } from "../utils/dushani-registrationValidation";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:5000/api";

export type EvidenceKind = "PHOTO" | "VIDEO";

export type ExtendedReportStatus =
  | "PENDING_VERIFICATION"
  | "ADDITIONAL_INFO_REQUIRED"
  | "VERIFIED"
  | "REJECTED"
  | "RESOLVED";

/** Evidence as it is uploaded: an inline data URL captured on the handset. */
export interface EvidenceInput {
  dataUrl: string;
  fileKind: EvidenceKind;
  contentType?: string;
}

export interface EvidenceAttachment {
  id: string;
  reportId: string;
  fileUrl: string;
  fileKind: EvidenceKind;
  contentType?: string;
  createdAt?: string;
}

export interface ExtendedReport {
  id: string;
  reportId: string;
  hazardType: string;
  severityLevel: string;
  locationDistrict: string;
  locationLat?: number;
  locationLng?: number;
  landmark?: string;
  description: string;
  affectedPopulation?: number;
  immediateDanger: boolean;
  observedAt?: string;
  status: ExtendedReportStatus;
  verificationNotes?: string;
  verifiedByName?: string;
  infoRequestReason?: string;
  infoRequestedByName?: string;
  infoRequestedAt?: string;
  warningCount?: number;
  attachments: EvidenceAttachment[];
  createdAt: string;
  updatedAt: string;
}

/** The multi-step form payload (also used for an A2 resubmission). */
export interface DetailedReportPayload {
  hazardType: string;
  severityLevel: string;
  locationDistrict: string;
  description: string;
  observedAt: string;
  locationLat?: number;
  locationLng?: number;
  landmark?: string;
  affectedPopulation?: number;
  immediateDanger?: boolean;
  attachments?: EvidenceInput[];
}

function request(token: string, extra: AxiosRequestConfig = {}): AxiosRequestConfig {
  return {
    ...extra,
    // Evidence uploads are large; give them room.
    timeout: 60000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(extra.headers ?? {}),
    },
  };
}

function toError(error: unknown): AlertApiError {
  if (axios.isAxiosError(error)) {
    // No response at all means the handset could not reach SafePlus (E1).
    if (!error.response) {
      return new AlertApiError(
        "Cannot reach SafePlus. Check your connection and try again.",
        null
      );
    }

    const data = error.response.data as { message?: string; errors?: FieldErrors };

    return new AlertApiError(
      data?.message ?? "The request could not be completed.",
      error.response.status,
      data?.errors ?? {}
    );
  }

  return new AlertApiError(
    error instanceof Error ? error.message : "Unexpected error.",
    null
  );
}

export async function resolveDistrictName(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const { data } = await axios.post<{ district: string | null }>(
      `${BASE_URL}/geo/resolve`,
      { lat, lng },
      { timeout: 10000 }
    );

    return data.district;
  } catch {
    return null;
  }
}

export async function submitDetailedReport(
  token: string,
  payload: DetailedReportPayload
): Promise<ExtendedReport> {
  try {
    const { data } = await axios.post<{ report: ExtendedReport }>(
      `${BASE_URL}/reports/detailed`,
      payload,
      request(token)
    );

    return data.report;
  } catch (error) {
    throw toError(error);
  }
}

export async function fetchMyReportsExtended(
  token: string
): Promise<ExtendedReport[]> {
  try {
    const { data } = await axios.get<{ reports: ExtendedReport[] }>(
      `${BASE_URL}/reports/mine/list`,
      request(token)
    );

    return data.reports;
  } catch (error) {
    throw toError(error);
  }
}

export async function fetchMyReportDetail(
  token: string,
  id: string
): Promise<ExtendedReport> {
  try {
    const { data } = await axios.get<{ report: ExtendedReport }>(
      `${BASE_URL}/reports/mine/${encodeURIComponent(id)}`,
      request(token)
    );

    return data.report;
  } catch (error) {
    throw toError(error);
  }
}

export async function resubmitReport(
  token: string,
  id: string,
  payload: DetailedReportPayload
): Promise<ExtendedReport> {
  try {
    const { data } = await axios.put<{ report: ExtendedReport }>(
      `${BASE_URL}/reports/mine/${encodeURIComponent(id)}/resubmit`,
      payload,
      request(token)
    );

    return data.report;
  } catch (error) {
    throw toError(error);
  }
}

export interface ReportNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  relatedReportId?: string;
  createdAt: string;
}

/** A2/A3/success: officer decisions land in the same inbox as DMC alerts. */
export async function fetchMyReportNotifications(
  token: string
): Promise<{ notifications: ReportNotification[]; unreadCount: number }> {
  try {
    const { data } = await axios.get<{
      notifications: ReportNotification[];
      unreadCount: number;
    }>(`${BASE_URL}/notifications`, request(token));

    return data;
  } catch (error) {
    throw toError(error);
  }
}

export async function markMyNotificationRead(
  token: string,
  id: string
): Promise<void> {
  try {
    await axios.put(
      `${BASE_URL}/notifications/${encodeURIComponent(id)}/read`,
      {},
      request(token)
    );
  } catch (error) {
    throw toError(error);
  }
}
