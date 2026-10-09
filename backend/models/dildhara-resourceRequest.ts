export type ResourceRequestUrgency =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type ResourceRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "FULFILLED"
  | "CANCELLED";

export interface ResourceRequest {
  id: string;
  requesterUserId: string;

  resourceType: string;
  resourceName: string;
  description: string | null;

  quantity: number;
  unit: string;

  urgency: ResourceRequestUrgency;

  requiredDate: string | null;

  location: string;
  district: string;

  status: ResourceRequestStatus;

  createdAt: string;
  updatedAt: string;
}

export interface CreateResourceRequestInput {
  resourceType: string;
  resourceName: string;
  description?: string;
  quantity: number;
  unit: string;
  urgency: ResourceRequestUrgency;
  requiredDate?: string;
  location: string;
  district: string;
}