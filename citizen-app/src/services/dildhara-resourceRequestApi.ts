import axios from "axios";

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

export interface CreateResourceRequestData {
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

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  "http://localhost:5000/api";

export class ResourceRequestApiError extends Error {
  status?: number;

  constructor(
    message: string,
    status?: number
  ) {
    super(message);
    this.name = "ResourceRequestApiError";
    this.status = status;
  }
}

function toApiError(
  error: unknown,
  fallback: string
): ResourceRequestApiError {
  if (axios.isAxiosError(error)) {
    const message =
      error.response?.data?.message ||
      fallback;

    return new ResourceRequestApiError(
      message,
      error.response?.status
    );
  }

  return new ResourceRequestApiError(
    fallback
  );
}

function authConfig(token: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    timeout: 15000,
  };
}

export async function createResourceRequest(
  token: string,
  data: CreateResourceRequestData
): Promise<ResourceRequest> {
  try {
    const response = await axios.post(
      `${BASE_URL}/resource-requests`,
      data,
      authConfig(token)
    );

    return response.data.request;
  } catch (error) {
    throw toApiError(
      error,
      "Could not create the resource request."
    );
  }
}

export async function fetchMyResourceRequests(
  token: string
): Promise<ResourceRequest[]> {
  try {
    const response = await axios.get(
      `${BASE_URL}/resource-requests/my`,
      authConfig(token)
    );

    return response.data.requests;
  } catch (error) {
    throw toApiError(
      error,
      "Could not load your resource requests."
    );
  }
}

export async function fetchMyResourceRequest(
  token: string,
  id: string
): Promise<ResourceRequest> {
  try {
    const response = await axios.get(
      `${BASE_URL}/resource-requests/my/${id}`,
      authConfig(token)
    );

    return response.data.request;
  } catch (error) {
    throw toApiError(
      error,
      "Could not load the resource request."
    );
  }
}