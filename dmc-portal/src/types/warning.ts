import type { HazardReport, SeverityLevel } from "./hazardReport";

export type WarningStatus =
  | "DRAFT"
  | "PENDING_DISPATCH"
  | "ACTIVE"
  | "EXPIRED"
  | "STOOD_DOWN";

export type ChannelType = "push" | "sms" | "siren";

export type BroadcastStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "PARTIAL"
  | "SKIPPED";

export type BoundarySource = "DISTRICT" | "CUSTOM";

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface ChannelSelection {
  push: boolean;
  sms: boolean;
  siren: boolean;
}

export interface GISPolygon {
  id: string;
  warningId: string;
  source: BoundarySource;
  coordinates: Coordinate[];
  areaSqKm: number;
  districtOverlapRatio?: number;
  isValid: boolean;
  createdAt: string;
}

export interface BroadcastLog {
  id: string;
  warningId: string;
  channelType: ChannelType;
  status: BroadcastStatus;
  dispatchedAt: string;
  targetCount: number;
  deliveryCount: number;
  failureCount: number;
  errorMessage?: string;
}

export interface DisasterWarning {
  id: string;
  warningId: string;
  reportId: string;
  report?: HazardReport;
  hazardType: string;
  severityLevel: SeverityLevel;
  targetDistrict: string;
  safetyInstructions?: string;
  status: WarningStatus;
  englishMessage: string;
  sinhalaMessage: string;
  tamilMessage: string;
  channels: ChannelSelection;
  officerId: string;
  audienceCount: number;
  smsRecipientCount: number;
  estimatedReach?: number;
  startTime?: string;
  expiresAt?: string;
  expiresInHours?: number;
  createdAt: string;
  updatedAt: string;
  broadcastAt?: string;
  gisPolygon?: GISPolygon;
  broadcastLogs?: BroadcastLog[];
}

/** Hours the officer may keep a broadcast warning active for. */
export const WARNING_LIFETIME_HOURS = [1, 3, 6, 12, 24, 48, 72, 168];

/** One extension cannot quietly keep an emergency warning alive forever. */
export const EXPIRY_EXTENSION_HOURS = [3, 6, 12, 24];

export interface CreateDraftRequest {
  reportId: string;
  hazardType: string;
  severityLevel: SeverityLevel;
  targetDistrict: string;
  customBoundary?: Coordinate[];
  safetyInstructions?: string;
  englishMessage: string;
  sinhalaMessage: string;
  tamilMessage: string;
  channels: ChannelSelection;
  expiresInHours: number;
}

export interface AudiencePreview {
  targetDistrict: string;
  registeredResidents: number;
  pushCapable: number;
  smsCapable: number;
  outsideBoundary: number;
  audienceCount: number;
  hasCustomBoundary: boolean;
  canBroadcast: boolean;
}

export interface DistrictBoundary {
  district: string;
  iso: string;
  areaSqKm: number;
  centroid: Coordinate;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

export interface DistrictCoverage {
  district: string | null;
  count: number;
}
