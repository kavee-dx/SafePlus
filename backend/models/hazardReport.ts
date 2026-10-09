export enum ReportStatus {
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  RESOLVED = "RESOLVED",
}

export enum SeverityLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum NotificationType {
  REPORT_SUBMITTED = "REPORT_SUBMITTED",
  REPORT_VERIFIED = "REPORT_VERIFIED",
  REPORT_REJECTED = "REPORT_REJECTED",
  WARNING_CREATED = "WARNING_CREATED",
}

export const HAZARD_TYPES = [
  "FLOOD",
  "LANDSLIDE",
  "TSUNAMI",
  "CYCLONE",
  "HEAVY_RAIN",
  "STRONG_WIND",
  "LIGHTNING",
  "DROUGHT",
  "WILDFIRE",
  "COASTAL_EROSION",
  "LANDSLIDE_RISK",
  "EPIDEMIC",
  "INDUSTRIAL_ACCIDENT",
  "OTHER",
] as const;

export const SEVERITY_LEVELS = Object.values(SeverityLevel);

export interface HazardReport {
  id: string;
  reportId: string;
  reporterId?: string;
  reporterName?: string;
  reporterPhone?: string;
  hazardType: string;
  severityLevel: string;
  locationDistrict: string;
  locationLat?: number;
  locationLng?: number;
  description: string;
  affectedPopulation?: number;
  status: ReportStatus;
  verifiedBy?: string;
  verifiedAt?: Date;
  verificationNotes?: string;
  warningCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReportRequest {
  hazardType: string;
  severityLevel: string;
  locationDistrict: string;
  locationLat?: number;
  locationLng?: number;
  description: string;
  affectedPopulation?: number;
}

export interface VerifyReportRequest {
  status: ReportStatus.VERIFIED | ReportStatus.REJECTED;
  verificationNotes?: string;
}

export interface ReportAttachment {
  id: string;
  reportId: string;
  fileUrl: string;
  fileType?: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedReportId?: string;
  relatedWarningId?: string;
  createdAt: Date;
}
