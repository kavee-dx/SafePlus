import type { HazardReport } from "./hazardReport";

export enum WarningStatus {
  DRAFT = "DRAFT",
  PENDING_DISPATCH = "PENDING_DISPATCH",
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  STOOD_DOWN = "STOOD_DOWN",
}

export enum ChannelType {
  PUSH = "push",
  SMS = "sms",
  SIREN = "siren",
}

export enum BroadcastStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  PARTIAL = "PARTIAL",
}

export enum BoundarySource {
  DISTRICT = "DISTRICT",
  CUSTOM = "CUSTOM",
}

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
  createdAt: Date;
}

export interface AlertPayload {
  id: string;
  warningId: string;
  englishText: string;
  sinhalaText: string;
  tamilText: string;
  createdAt: Date;
}

export interface BroadcastLog {
  id: string;
  warningId: string;
  channelType: ChannelType;
  status: BroadcastStatus;
  dispatchedAt: Date;
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
  severityLevel: string;
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
  startTime?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  broadcastAt?: Date;
  gisPolygon?: GISPolygon;
  alertPayload?: AlertPayload;
  broadcastLogs?: BroadcastLog[];
}

export interface CreateDraftRequest {
  reportId: string;
  hazardType: string;
  severityLevel: string;
  targetDistrict: string;
  customBoundary?: Coordinate[];
  safetyInstructions?: string;
  englishMessage: string;
  sinhalaMessage: string;
  tamilMessage: string;
  channels: ChannelSelection;
  draftExpiresInHours?: number;
}

export interface BroadcastWarningRequest {
  warningId: string;
  securityPin: string;
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
