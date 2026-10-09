import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DispatchManagementSection from "../src/pages/dildhara-DispatchManagementSection";
import {
  fetchDispatchAssignmentOptions,
  fetchDispatchDetails,
  fetchDispatches,
  fetchReliefAllocations,
} from "../src/services/dildhara-reliefOperationsApi";

vi.mock("../src/services/dildhara-reliefOperationsApi", () => ({
  assignDispatchTrip: vi.fn(),
  confirmDispatchDelivery: vi.fn(),
  createDispatchForAllocation: vi.fn(),
  fetchDispatchAssignmentOptions: vi.fn(),
  fetchDispatches: vi.fn(),
  fetchDispatchDetails: vi.fn(),
  fetchReliefAllocationDetails: vi.fn(),
  fetchReliefAllocations: vi.fn(),
  markDispatchDeparted: vi.fn(),
  recordAgencyResponse: vi.fn(),
  recordDispatchTracking: vi.fn(),
}));

const dispatch = {
  id: "22222222-2222-4222-8222-222222222222",
  allocation_id: "11111111-1111-4111-8111-111111111111",
  status: "DELIVERED" as const,
  agency_response: "ACCEPTED" as const,
  planned_departure: null,
  notes: null,
  destination_name: "North Relief Centre",
  destination_location: "Jaffna",
  destination_district: "Jaffna",
  assignments: [],
  items: [],
  tracking: [],
  deliveryConfirmations: [],
};

const savedDispatch = {
  ...dispatch,
  deliveryConfirmations: [{
    id: "55555555-5555-4555-8555-555555555555",
    receiver_name: "Kamal Perera",
    receiver_phone: "0771234567",
    delivery_condition: "PARTIAL" as const,
    delivered_at: "2026-10-01T12:30:00.000Z",
    notes: "Two cartons were damaged.",
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchReliefAllocations).mockResolvedValue([]);
  vi.mocked(fetchDispatches).mockResolvedValue([dispatch]);
  vi.mocked(fetchDispatchAssignmentOptions).mockResolvedValue({
    vehicles: [],
    volunteers: [],
    drivers: [],
    teams: [],
  });
  vi.mocked(fetchDispatchDetails).mockResolvedValue(savedDispatch);
});

describe("dispatch register", () => {
  it("loads a saved dispatch after reopening it from the persisted register", async () => {
    render(<DispatchManagementSection token="coordinator-token" onSessionExpired={vi.fn()} />);

    const savedEntry = await screen.findByRole("button", { name: /North Relief Centre.*DELIVERED/i });
    fireEvent.click(savedEntry);

    await waitFor(() => expect(fetchDispatchDetails).toHaveBeenCalledWith(
      "coordinator-token",
      dispatch.id
    ));
    expect(await screen.findByText("Kamal Perera")).toBeTruthy();
    expect(screen.getByText("Two cartons were damaged.")).toBeTruthy();
  });
});
