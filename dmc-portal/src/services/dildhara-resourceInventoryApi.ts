
import axios from "axios";
import api from "./api";

export type ContributorType = "INDIVIDUAL" | "ORGANIZATION";

export type AvailabilityCondition =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "EXPIRED"
  | "CANCELLED"
  | "NOT_YET_AVAILABLE"
  | "AVAILABILITY_ENDED";

export type ExpiryCondition =
  | "NO_EXPIRY"
  | "EXPIRED"
  | "EXPIRING_SOON"
  | "NEAR_EXPIRY"
  | "VALID";

export interface InventoryResource {
  id: string;
  provider_user_id: string;
  provider_name: string;
  provider_role: string;
  contributor_type: ContributorType;

  resource_type: string;
  resource_name: string;
  description: string | null;
  quantity: string | number;
  unit: string;
  location: string | null;
  district: string;

  available_from: string | null;
  available_until: string | null;
  expiry_date: string | null;
  status: string;

  availability_condition: AvailabilityCondition;
  expiry_condition: ExpiryCondition;

  created_at: string;
  updated_at: string;
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "Cannot connect to SafePlus. Check that the backend is running.";
    }

    return error.response.data?.message ??
      "Could not load the resource inventory.";
  }

  return error instanceof Error
    ? error.message
    : "Could not load the resource inventory.";
}

export async function fetchResourceInventory(
  token: string
): Promise<InventoryResource[]> {
  try {
    const { data } = await api.get("/resources/inventory", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return data.resources as InventoryResource[];
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}