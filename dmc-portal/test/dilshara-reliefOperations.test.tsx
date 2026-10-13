import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ReliefOperationsPage from "../src/pages/dildhara-ReliefOperationsPage";
import {
  createReliefAllocation,
  fetchAvailableReliefResources,
  fetchReliefAllocations,
  reserveReliefAllocation,
} from "../src/services/dildhara-reliefOperationsApi";
import { fetchResourceRequests } from "../src/services/dildhara-resourceRequestApi";

vi.mock("../src/pages/dildhara-DispatchManagementSection", () => ({
  default: () => <div>Dispatch management section</div>,
}));

vi.mock("../src/services/dildhara-reliefOperationsApi", () => ({
  cancelReliefAllocation: vi.fn(),
  createReliefAllocation: vi.fn(),
  fetchAvailableReliefResources: vi.fn(),
  fetchReliefAllocations: vi.fn(),
  reserveReliefAllocation: vi.fn(),
}));

vi.mock("../src/services/dildhara-resourceRequestApi", () => ({
  fetchResourceRequests: vi.fn(),
}));

const resource = {
  id: "33333333-3333-4333-8333-333333333333",
  resource_name: "Drinking water",
  resource_type: "WATER",
  quantity: 12,
  unit: "litres",
  district: "Jaffna",
  location: "Warehouse A",
  expiry_date: null,
  available_quantity: 5,
};

const allocation = {
  id: "11111111-1111-4111-8111-111111111111",
  allocation_type: "AREA" as const,
  request_id: null,
  destination_name: "North Relief Centre",
  destination_location: "Jaffna",
  destination_district: "Jaffna",
  status: "DRAFT" as const,
  notes: null,
  created_at: "2026-10-01T00:00:00.000Z",
  items: [{ id: "44444444-4444-4444-8444-444444444444", resource_id: resource.id, resource_name: resource.resource_name, quantity: 4, unit: "litres" }],
};

const allocationApi = {
  create: vi.mocked(createReliefAllocation),
  resources: vi.mocked(fetchAvailableReliefResources),
  allocations: vi.mocked(fetchReliefAllocations),
  reserve: vi.mocked(reserveReliefAllocation),
  requests: vi.mocked(fetchResourceRequests),
};

beforeEach(() => {
  vi.clearAllMocks();
  allocationApi.resources.mockResolvedValue([resource]);
  allocationApi.allocations.mockResolvedValue([]);
  allocationApi.requests.mockResolvedValue([]);
});

function renderPage() {
  const onSessionExpired = vi.fn();
  render(<ReliefOperationsPage token="coordinator-token" onSessionExpired={onSessionExpired} />);
  return { onSessionExpired };
}

function enterDestination(name = "North Centre") {
  fireEvent.change(screen.getByLabelText("Destination name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Destination location"), { target: { value: "Jaffna" } });
  fireEvent.change(screen.getByLabelText("District"), { target: { value: "Jaffna" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to resource selection" }));
}

describe("Relief Operations allocation UI", () => {
  it("prevents draft submission when a requested quantity exceeds available stock", async () => {
    renderPage();
    enterDestination("North Relief Centre");
    const quantityInput = await screen.findByLabelText("Quantity (litres)");
    fireEvent.change(quantityInput, { target: { value: "6" } });
    const form = screen.getByRole("button", { name: "Create draft" }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(await screen.findByText(/exceeds the available stock/i)).toBeTruthy();
    expect(allocationApi.create).not.toHaveBeenCalled();
  });

  it("creates a DRAFT first and reserves it only after the coordinator chooses to reserve", async () => {
    allocationApi.create.mockResolvedValue(allocation);
    allocationApi.allocations
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([allocation])
      .mockResolvedValueOnce([{ ...allocation, status: "RESERVED" }]);
    allocationApi.reserve.mockResolvedValue(undefined);
    renderPage();

    enterDestination("North Relief Centre");
    fireEvent.change(await screen.findByLabelText("Quantity (litres)"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    await waitFor(() => expect(allocationApi.create).toHaveBeenCalledWith(
      "coordinator-token",
      expect.objectContaining({
        allocationType: "AREA",
        destinationName: "North Relief Centre",
        items: [{ resourceId: resource.id, quantity: 4 }],
      })
    ));
    expect(await screen.findByText("DRAFT")).toBeTruthy();
    expect(allocationApi.reserve).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reserve stock" }));
    await waitFor(() => expect(allocationApi.reserve).toHaveBeenCalledWith(
      "coordinator-token",
      allocation.id
    ));
    expect(await screen.findByText("RESERVED")).toBeTruthy();
    expect(allocationApi.allocations).toHaveBeenCalledTimes(3);
  });

  it("navigates between resource selection and a separate allocation register view", async () => {
    allocationApi.allocations.mockResolvedValue([allocation]);
    renderPage();

    expect(screen.queryByText("Dispatch management section")).toBeTruthy();
    expect(screen.queryByText("No allocations have been created yet.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Allocation register" }));
    expect(await screen.findByText("North Relief Centre")).toBeTruthy();
    expect(screen.queryByLabelText("Quantity (litres)")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "1. Allocation details" }));
    expect(await screen.findByLabelText("Destination name")).toBeTruthy();
    expect(screen.queryByText("North Relief Centre")).toBeNull();
  });

  it("shows allocation and request names instead of their IDs in the register", async () => {
    const requestAllocation = {
      ...allocation,
      allocation_type: "REQUEST" as const,
      request_id: "55555555-5555-4555-8555-555555555555",
    };
    allocationApi.allocations.mockResolvedValue([requestAllocation]);
    allocationApi.requests.mockResolvedValue([{
      id: requestAllocation.request_id,
      requesterUserId: "66666666-6666-4666-8666-666666666666",
      resourceType: "WATER",
      resourceName: "Drinking water",
      quantity: 20,
      unit: "Bottles",
      description: null,
      urgency: "HIGH",
      requiredDate: null,
      location: "Colombo",
      district: "Colombo",
      status: "APPROVED",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    }]);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Allocation register" }));

    expect(await screen.findByText(/Request: Drinking water · 20 Bottles/)).toBeTruthy();
    expect(screen.queryByText(requestAllocation.id)).toBeNull();
    expect(screen.queryByText(requestAllocation.request_id)).toBeNull();
    expect(screen.queryByText("66666666-6666-4666-8666-666666666666")).toBeNull();
  });

  it("shows a load failure and notifies the host when the session has expired", async () => {
    allocationApi.resources.mockRejectedValueOnce(new Error("401 Authentication required."));
    const { onSessionExpired } = renderPage();

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Dispatch management section")).toBeTruthy();
  });

  it("shows a recoverable loading error without losing the page", async () => {
    allocationApi.resources.mockRejectedValueOnce(new Error("Inventory service is unavailable."));
    renderPage();

    expect(await screen.findByText("Inventory service is unavailable.")).toBeTruthy();
    expect(screen.getByText("Dispatch management section")).toBeTruthy();
  });
});
