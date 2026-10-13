import axios, { isAxiosError } from "axios";

export interface DeliveryItem {
  id: string;
  resourceName: string;
  resourceType: string;
  pickupLocation: string | null;
  pickupDistrict: string;
  quantityDispatched: number | string;
  quantityReceived: number | string | null;
  quantityDamaged: number | string;
  quantityMissing: number | string;
  unit: string;
}

export interface DeliveryAssignment {
  assignmentId: string;
  tripNumber: number;
  assignmentStatus: string;
  assignmentNotes: string | null;
  dispatchId: string;
  dispatchStatus: string;
  agencyResponse: string;
  plannedDeparture: string | null;
  actualDeparture: string | null;
  destinationName: string | null;
  destinationLocation: string;
  destinationDistrict: string;
  driverName: string | null;
  volunteerName: string | null;
  teamName: string | null;
  items: DeliveryItem[];
}

export class DeliveryApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message);
    this.name = "DeliveryApiError";
  }
}

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:5000/api";

export async function fetchMyDeliveries(
  token: string
): Promise<DeliveryAssignment[]> {
  try {
    const { data } = await axios.get(`${BASE_URL}/relief-operations/dispatches/my-deliveries`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });

    if (!Array.isArray(data.assignments)) {
      throw new DeliveryApiError(
        "The server returned an unexpected delivery list.",
        null
      );
    }

    return data.assignments as DeliveryAssignment[];
  } catch (error) {
    if (error instanceof DeliveryApiError) throw error;

    if (isAxiosError(error)) {
      if (!error.response) {
        throw new DeliveryApiError(
          "Cannot connect to SafePlus. Check that the backend is running.",
          null
        );
      }

      const body = error.response.data as { message?: string };
      throw new DeliveryApiError(
        body?.message || "Could not load your deliveries.",
        error.response.status
      );
    }

    throw error;
  }
}
