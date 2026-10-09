export type ReportStatus =
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED"
  | "RESOLVED";

export type SeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface HazardReport {
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
  description: string;
  affectedPopulation?: number;
  status: ReportStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  warningCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportRequest {
  hazardType: string;
  severityLevel: SeverityLevel;
  locationDistrict: string;
  locationLat?: number;
  locationLng?: number;
  description: string;
  affectedPopulation?: number;
}

export type NotificationType =
  | "REPORT_SUBMITTED"
  | "REPORT_VERIFIED"
  | "REPORT_REJECTED"
  | "REPORT_INFO_REQUESTED"
  | "WARNING_CREATED";

export interface PortalNotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedReportId?: string;
  relatedWarningId?: string;
  createdAt: string;
}
