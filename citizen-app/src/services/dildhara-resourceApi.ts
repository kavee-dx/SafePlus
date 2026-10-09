import axios from "axios";

import { AuthApiError } from "./dildhara-authApi";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  "http://localhost:5000/api";

export interface Resource {
  id: string;
  provider_user_id: string;

  resource_type: string;
  resource_name: string;
  description: string | null;

  quantity: string;
  unit: string;

  location: string | null;
  district: string;

  available_from: string | null;
  available_until: string | null;
  expiry_date: string | null;

  status: string;

  created_at: string;
  updated_at: string;
}

interface ResourceResponse {
  resource: Resource;
}

interface ResourcesResponse {
  resources: Resource[];
}

function toApiError(
  error: unknown,
  fallback: string
): unknown {
  if (!axios.isAxiosError(error)) {
    return error;
  }

  if (!error.response) {
    return new AuthApiError(
      "Cannot reach the server. Check your connection and try again.",
      null
    );
  }

  const body = error.response.data as {
    message?: string;
    errors?: Record<string, string>;
  };

  return new AuthApiError(
    body?.message || fallback,
    error.response.status,
    body?.errors ?? {}
  );
}

const authHeader = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
  timeout: 15000,
});

export interface CreateResourcePayload {
  resourceType: string;
  resourceName: string;
  description?: string;
  quantity: number;
  unit: string;
  location?: string;
  district: string;
  availableFrom?: string;
  availableUntil?: string;
  expiryDate?: string;
}

export async function createResource(
  token: string,
  payload: CreateResourcePayload
): Promise<Resource> {
  try {
    const { data } = await axios.post<ResourceResponse>(
      `${BASE_URL}/resources`,
      payload,
      authHeader(token)
    );

    return data.resource;
  } catch (error) {
    throw toApiError(
      error,
      "Could not provide the resource."
    );
  }
}

export async function fetchMyResources(
  token: string
): Promise<Resource[]> {
  try {
    const { data } = await axios.get<ResourcesResponse>(
      `${BASE_URL}/resources/my`,
      authHeader(token)
    );

    return data.resources;
  } catch (error) {
    throw toApiError(
      error,
      "Could not load your resources."
    );
  }
}

export async function fetchMyResource(
  token: string,
  resourceId: string
): Promise<Resource> {
  try {
    const { data } = await axios.get<ResourceResponse>(
      `${BASE_URL}/resources/${resourceId}`,
      authHeader(token)
    );

    return data.resource;
  } catch (error) {
    throw toApiError(
      error,
      "Could not load the resource."
    );
  }
}

export async function updateResource(
  token: string,
  resourceId: string,
  payload: Partial<CreateResourcePayload> & {
    status?: string;
  }
): Promise<Resource> {
  try {
    const { data } = await axios.patch<ResourceResponse>(
      `${BASE_URL}/resources/${resourceId}`,
      payload,
      authHeader(token)
    );

    return data.resource;
  } catch (error) {
    throw toApiError(
      error,
      "Could not update the resource."
    );
  }
}

export async function deleteResource(
  token: string,
  resourceId: string
): Promise<void> {
  try {
    await axios.delete(
      `${BASE_URL}/resources/${resourceId}`,
      authHeader(token)
    );
  } catch (error) {
    throw toApiError(
      error,
      "Could not remove the resource."
    );
  }
}