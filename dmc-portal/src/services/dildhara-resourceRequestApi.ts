
import axios from "axios";
import api from "./api";

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
  quantity: number;
  unit: string;
  description: string | null;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  requiredDate: string | null;
  location: string | null;
  district: string | null;
  status: ResourceRequestStatus;
  createdAt: string;
  updatedAt: string;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "Cannot connect to SafePlus. Check that the backend is running.";
    }

    return (
      error.response.data?.message ??
      "Something went wrong. Please try again."
    );
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong.";
}

function authConfig(token: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export async function fetchResourceRequests(
  token: string
): Promise<ResourceRequest[]> {
  try {
    const { data } = await api.get(
      "/resource-requests/dashboard",
      authConfig(token)
    );

    return data.requests as ResourceRequest[];
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function fetchResourceRequest(
  token: string,
  requestId: string
): Promise<ResourceRequest> {
  try {
    const { data } = await api.get(
      `/resource-requests/my/${encodeURIComponent(requestId)}`,
      authConfig(token)
    );

    return data.request as ResourceRequest;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function reviewResourceRequest(
  token: string,
  requestId: string,
  action: "APPROVED" | "REJECTED",
  reviewNote?: string
): Promise<ResourceRequest> {
  try {
    const { data } = await api.patch(
      `/resource-requests/${encodeURIComponent(requestId)}/status`,
      {
        status: action,
        reviewNote: reviewNote?.trim() || null,
      },
      authConfig(token)
    );

    return data.request as ResourceRequest;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}