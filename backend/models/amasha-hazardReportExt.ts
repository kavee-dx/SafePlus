/**
 * UC-02 extensions to the ground-report model. The base ReportStatus /
 * HazardReport types live in ./hazardReport and are left untouched; this file
 * adds the extra lifecycle state and columns the multi-step submission,
 * evidence upload and "additional information required" round-trip need.
 */

/** Report lifecycle including the A2 "ask the citizen for more" state. */
export type ExtendedReportStatus =
  | "PENDING_VERIFICATION"
  | "ADDITIONAL_INFO_REQUIRED"
  | "VERIFIED"
  | "REJECTED"
  | "RESOLVED";

export const ADDITIONAL_INFO_REQUIRED = "ADDITIONAL_INFO_REQUIRED";

export type EvidenceKind = "PHOTO" | "VIDEO";

/** One photo/video attached to a report, stored inline as a data URL. */
export interface EvidenceAttachment {
  id: string;
  reportId: string;
  fileUrl: string;
  fileKind: EvidenceKind;
  contentType?: string;
  createdAt?: Date;
}

/** A ground report with every UC-02 field, as the portal and app consume it. */
export interface ExtendedHazardReport {
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
  landmark?: string;
  description: string;
  affectedPopulation?: number;
  immediateDanger: boolean;
  observedAt?: Date;
  status: ExtendedReportStatus;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: Date;
  verificationNotes?: string;
  infoRequestReason?: string;
  infoRequestedByName?: string;
  infoRequestedAt?: Date;
  warningCount?: number;
  attachments: EvidenceAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

/** Evidence as it arrives from the citizen app before it is persisted. */
export interface EvidenceInput {
  dataUrl: string;
  fileKind: EvidenceKind;
  contentType?: string;
}

/** Payload for the first submission and for an A2 resubmission. */
export interface DetailedReportInput {
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

export interface RequestInfoInput {
  reason: string;
}
