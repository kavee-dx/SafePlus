import axios, { type AxiosRequestConfig } from "axios";

import type { FieldErrors } from "../utils/dushani-registrationValidation";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:5000/api";

export class AlertApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly fieldErrors: FieldErrors = {}
  ) {
    super(message);
    this.name = "AlertApiError";
  }
}

export type ReportStatus =
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED"
  | "RESOLVED";

export interface HazardReportView {
  id: string;
  reportId: string;
  hazardType: string;
  severityLevel: string;
  locationDistrict: string;
  description: string;
  status: ReportStatus;
  verificationNotes?: string;
  warningCount?: number;
  createdAt: string;
}

export interface NewHazardReport {
  hazardType: string;
  severityLevel: string;
  locationDistrict: string;
  description: string;
  locationLat?: number;
  locationLng?: number;
  affectedPopulation?: number;
}

export interface AlertTarget {
  deviceToken?: string;
  latitude?: number;
  longitude?: number;
}

function request(
  token?: string,
  extra: AxiosRequestConfig = {}
): AxiosRequestConfig {
  return {
    ...extra,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extra.headers ?? {}),
    },
  };
}

function toError(error: unknown): AlertApiError {
  if (axios.isAxiosError(error)) {
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

export async function fetchDistrictNames(): Promise<string[]> {
  try {
    const { data } = await axios.get<{ districts: { district: string }[] }>(
      `${BASE_URL}/geo/districts`,
      request()
    );

    return data.districts.map((item) => item.district);
  } catch (error) {
    throw toError(error);
  }
}

export async function submitHazardReport(
  token: string,
  report: NewHazardReport
): Promise<HazardReportView> {
  try {
    const { data } = await axios.post<{ report: HazardReportView }>(
      `${BASE_URL}/reports`,
      report,
      request(token)
    );

    return data.report;
  } catch (error) {
    throw toError(error);
  }
}

export async function fetchMyReports(token: string): Promise<HazardReportView[]> {
  try {
    const { data } = await axios.get<{ reports: HazardReportView[] }>(
      `${BASE_URL}/reports/my`,
      request(token)
    );

    return data.reports;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * Tells SafePlus how to reach this phone and where it last was. The warning
 * audience is counted from these rows, so a citizen who never registers is
 * silently invisible to a district broadcast.
 */
export async function saveAlertTarget(
  token: string,
  target: AlertTarget
): Promise<void> {
  if (!target.deviceToken && target.latitude === undefined) {
    return;
  }

  try {
    await axios.put(`${BASE_URL}/alert-target`, target, request(token));
  } catch (error) {
    throw toError(error);
  }
}
