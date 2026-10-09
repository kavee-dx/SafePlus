
import axios from "axios";
import api from "./api";

export type ReliefDispatchFocus = "planning" | "assignment";

export interface AvailableReliefResource {
  id: string;
  resource_name: string;
  resource_type: string;
  quantity: number | string;
  unit: string;
  district: string;
  location: string | null;
  expiry_date: string | null;
  available_quantity: number | string;
}

export type AllocationStatus =
  | "DRAFT"
  | "RESERVED"
  | "DISPATCHED"
  | "COMPLETED"
  | "CANCELLED";

export interface ReliefAllocationItem {
  id?: string;
  resource_id: string;
  resource_name?: string;
  resource_type?: string;
  quantity: number | string;
  unit?: string;
  expiry_date?: string | null;
}

export interface ReliefAllocation {
  id: string;
  allocation_type: "REQUEST" | "AREA";
  request_id: string | null;
  destination_name: string;
  destination_location: string;
  destination_district: string;
  status: AllocationStatus;
  notes: string | null;
  created_at: string;
  items?: ReliefAllocationItem[];
}

export interface CreateAllocationInput {
  allocationType: "REQUEST" | "AREA";
  requestId?: string;
  destinationName: string;
  destinationLocation: string;
  destinationDistrict: string;
  notes?: string;
  items: {
    resourceId: string;
    quantity: number;
  }[];
}

export type DispatchStatus =
  | "PLANNED"
  | "READY"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export type AgencyResponse = "PENDING" | "ACCEPTED" | "REJECTED";

export type DeliveryCondition =
  | "ACCEPTED"
  | "PARTIAL"
  | "DAMAGED"
  | "REJECTED";

export interface DispatchItem {
  id: string;
  assignment_id: string;
  allocation_item_id: string;
  quantity_dispatched: number | string;
  quantity_received: number | string | null;
  quantity_damaged: number | string | null;
  quantity_missing: number | string | null;
  resource_id?: string;
  resource_name?: string;
  resource_type?: string;
  unit?: string;
}

export interface DispatchAssignment {
  id: string;
  dispatch_id: string;
  vehicle_id: string | null;
  driver_user_id: string | null;
  volunteer_profile_id: string | null;
  team_profile_id: string | null;
  trip_number: number;
  status: string;
  notes: string | null;
  vehicle_registration_number?: string | null;
  vehicle_type?: string | null;
  max_payload_kg?: number | string | null;
  driver_name?: string | null;
  volunteer_name?: string | null;
  team_name?: string | null;
}

export interface DispatchTrackingUpdate {
  id: string;
  dispatch_id: string;
  status: string;
  location_label: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  notes: string | null;
  reported_at: string;
}

export interface ReliefDispatch {
  id: string;
  allocation_id: string;
  status: DispatchStatus;
  agency_response: AgencyResponse;
  agency_response_notes?: string | null;
  planned_departure: string | null;
  actual_departure?: string | null;
  completed_at?: string | null;
  notes: string | null;
  destination_name?: string;
  destination_location?: string;
  destination_district?: string;
  allocation_type?: "REQUEST" | "AREA";
  allocation_status?: string;
  assignments: DispatchAssignment[];
  items: DispatchItem[];
  tracking: DispatchTrackingUpdate[];
  deliveryConfirmations: DeliveryConfirmation[];
}

export interface DeliveryConfirmation {
  id: string;
  receiver_name: string | null;
  receiver_phone: string | null;
  delivery_condition: DeliveryCondition;
  delivered_at: string;
  notes: string | null;
}

export interface DispatchAssignmentOptions {
  vehicles: {
    id: string;
    vehicle_registration_number: string;
    vehicle_type: string;
    owner_type: string;
  }[];
  volunteers: {
    id: string;
    user_id: string;
    full_name: string;
    district: string | null;
  }[];
  drivers: {
    user_id: string;
    full_name: string;
    district: string | null;
  }[];
  teams: {
    id: string;
    user_id: string;
    team_name: string;
    operating_district: string;
    leader_name: string;
  }[];
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "Cannot connect to SafePlus. Check that the backend is running.";
    }

    return (
      error.response.data?.message ??
      "The relief operations request failed."
    );
  }

  return error instanceof Error
    ? error.message
    : "The relief operations request failed.";
}

function authConfig(token: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

function dispatchPath(dispatchId: string): string {
  return `/relief-operations/dispatches/${encodeURIComponent(dispatchId)}`;
}

export async function fetchAvailableReliefResources(
  token: string
): Promise<AvailableReliefResource[]> {
  try {
    const { data } = await api.get(
      "/relief-operations/resources/available",
      authConfig(token)
    );

    return data.resources ?? [];
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function fetchReliefAllocations(
  token: string
): Promise<ReliefAllocation[]> {
  try {
    const { data } = await api.get(
      "/relief-operations/allocations",
      authConfig(token)
    );

    return data.allocations ?? [];
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function fetchReliefAllocationDetails(
  token: string,
  allocationId: string
): Promise<ReliefAllocation> {
  try {
    const { data } = await api.get(
      `/relief-operations/allocations/${encodeURIComponent(allocationId)}`,
      authConfig(token)
    );

    if (!data.allocation) {
      throw new Error("Allocation details were not returned by the server.");
    }

    return data.allocation as ReliefAllocation;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function createReliefAllocation(
  token: string,
  input: CreateAllocationInput
): Promise<ReliefAllocation> {
  try {
    const { data } = await api.post(
      "/relief-operations/allocations",
      input,
      authConfig(token)
    );

    return data.allocation;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function reserveReliefAllocation(
  token: string,
  allocationId: string
): Promise<void> {
  try {
    await api.post(
      `/relief-operations/allocations/${encodeURIComponent(allocationId)}/reserve`,
      {},
      authConfig(token)
    );
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function cancelReliefAllocation(
  token: string,
  allocationId: string
): Promise<void> {
  try {
    await api.post(
      `/relief-operations/allocations/${encodeURIComponent(allocationId)}/cancel`,
      {},
      authConfig(token)
    );
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

// Dispatch management

export async function fetchDispatches(
  token: string
): Promise<ReliefDispatch[]> {
  try {
    const { data } = await api.get(
      "/relief-operations/dispatches",
      authConfig(token)
    );

    return data.dispatches ?? [];
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function fetchDispatchAssignmentOptions(
  token: string
): Promise<DispatchAssignmentOptions> {
  try {
    const { data } = await api.get(
      "/relief-operations/dispatches/assignment-options",
      authConfig(token)
    );

    return data as DispatchAssignmentOptions;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function createDispatchForAllocation(
  token: string,
  allocationId: string,
  input: { plannedDeparture?: string; notes?: string }
): Promise<ReliefDispatch> {
  try {
    const { data } = await api.post(
      `/relief-operations/dispatches/allocations/${encodeURIComponent(allocationId)}`,
      input,
      authConfig(token)
    );

    return data.dispatch ?? data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function fetchDispatchDetails(
  token: string,
  dispatchId: string
): Promise<ReliefDispatch> {
  try {
    const { data } = await api.get(
      dispatchPath(dispatchId),
      authConfig(token)
    );

    return data.dispatch ?? data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function recordAgencyResponse(
  token: string,
  dispatchId: string,
  input: { response: "ACCEPTED" | "REJECTED"; notes?: string }
): Promise<ReliefDispatch> {
  try {
    const { data } = await api.patch(
      `${dispatchPath(dispatchId)}/agency-response`,
      input,
      authConfig(token)
    );

    return data.dispatch ?? data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function assignDispatchTrip(
  token: string,
  dispatchId: string,
  input: {
    vehicleId?: string;
    driverUserId?: string;
    volunteerProfileId?: string;
    teamProfileId?: string;
    tripNumber: number;
    notes?: string;
    items: {
      allocationItemId: string;
      quantityDispatched: number;
    }[];
  }
): Promise<DispatchAssignment> {
  try {
    const { data } = await api.post(
      `${dispatchPath(dispatchId)}/assignments`,
      input,
      authConfig(token)
    );

    return data.assignment ?? data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function markDispatchDeparted(
  token: string,
  dispatchId: string
): Promise<ReliefDispatch> {
  try {
    const { data } = await api.patch(
      `${dispatchPath(dispatchId)}/depart`,
      {},
      authConfig(token)
    );

    return data.dispatch ?? data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function recordDispatchTracking(
  token: string,
  dispatchId: string,
  input: {
    locationLabel?: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  }
): Promise<DispatchTrackingUpdate> {
  try {
    const { data } = await api.post(
      `${dispatchPath(dispatchId)}/tracking`,
      input,
      authConfig(token)
    );

    return data.tracking ?? data.update ?? data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function confirmDispatchDelivery(
  token: string,
  dispatchId: string,
  input: {
    receiverName: string;
    receiverPhone?: string;
    condition: DeliveryCondition;
    notes?: string;
    items: {
      dispatchItemId: string;
      quantityReceived: number;
      quantityDamaged: number;
      quantityMissing: number;
    }[];
  }
): Promise<ReliefDispatch> {
  try {
    const { data } = await api.post(
      `${dispatchPath(dispatchId)}/delivery-confirmation`,
      input,
      authConfig(token)
    );

    return data.dispatch ?? data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}