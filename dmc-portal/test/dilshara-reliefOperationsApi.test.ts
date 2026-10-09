import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "../src/services/api";
import {
  createReliefAllocation,
  assignDispatchTrip,
  confirmDispatchDelivery,
  fetchDispatchDetails,
  fetchDispatches,
  fetchReliefAllocationDetails,
  fetchReliefAllocations,
  markDispatchDeparted,
  recordAgencyResponse,
  recordDispatchTracking,
  reserveReliefAllocation,
} from "../src/services/dildhara-reliefOperationsApi";

vi.mock("../src/services/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const client = vi.mocked(api);
const allocationId = "11111111-1111-4111-8111-111111111111";
const dispatchId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => vi.clearAllMocks());

describe("relief operations API", () => {
  it("loads current allocations and allocation details for a reopened register item", async () => {
    const allocation = { id: allocationId, status: "RESERVED" };
    client.get
      .mockResolvedValueOnce({ data: { allocations: [allocation] } } as never)
      .mockResolvedValueOnce({ data: { allocation } } as never);

    await expect(fetchReliefAllocations("coordinator-token")).resolves.toEqual([allocation]);
    await expect(fetchReliefAllocationDetails("coordinator-token", allocationId)).resolves.toEqual(allocation);

    expect(client.get).toHaveBeenNthCalledWith(
      1,
      "/relief-operations/allocations",
      { headers: { Authorization: expect.stringContaining("coordinator-token") } }
    );
    expect(client.get).toHaveBeenNthCalledWith(
      2,
      `/relief-operations/allocations/${allocationId}`,
      { headers: { Authorization: expect.stringContaining("coordinator-token") } }
    );
  });

  it("posts an allocation draft and reserves it through separate authenticated operations", async () => {
    const input = {
      allocationType: "AREA" as const,
      destinationName: "North Relief Centre",
      destinationLocation: "Jaffna",
      destinationDistrict: "Jaffna",
      items: [{ resourceId: "33333333-3333-4333-8333-333333333333", quantity: 4 }],
    };
    const allocation = { id: allocationId, status: "DRAFT" };
    client.post
      .mockResolvedValueOnce({ data: { allocation } } as never)
      .mockResolvedValueOnce({ data: {} } as never);

    await expect(createReliefAllocation("coordinator-token", input)).resolves.toEqual(allocation);
    await expect(reserveReliefAllocation("coordinator-token", allocationId)).resolves.toBeUndefined();

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      "/relief-operations/allocations",
      input,
      { headers: { Authorization: expect.stringContaining("coordinator-token") } }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      `/relief-operations/allocations/${allocationId}/reserve`,
      {},
      { headers: { Authorization: expect.stringContaining("coordinator-token") } }
    );
  });

  it("lists and reopens persisted dispatches, including response and departure mutations", async () => {
    const dispatch = { id: dispatchId, status: "READY", agency_response: "ACCEPTED" };
    client.get
      .mockResolvedValueOnce({ data: { dispatches: [dispatch] } } as never)
      .mockResolvedValueOnce({ data: { dispatch } } as never);
    client.patch
      .mockResolvedValueOnce({ data: { dispatch } } as never)
      .mockResolvedValueOnce({ data: { dispatch } } as never);

    await expect(fetchDispatches("coordinator-token")).resolves.toEqual([dispatch]);
    await expect(fetchDispatchDetails("coordinator-token", dispatchId)).resolves.toEqual(dispatch);
    await expect(recordAgencyResponse("coordinator-token", dispatchId, {
      response: "ACCEPTED",
      notes: "Receiving team confirmed.",
    })).resolves.toEqual(dispatch);
    await expect(markDispatchDeparted("coordinator-token", dispatchId)).resolves.toEqual(dispatch);

    expect(client.get).toHaveBeenNthCalledWith(
      2,
      `/relief-operations/dispatches/${dispatchId}`,
      { headers: { Authorization: expect.stringContaining("coordinator-token") } }
    );
    expect(client.patch).toHaveBeenNthCalledWith(
      1,
      `/relief-operations/dispatches/${dispatchId}/agency-response`,
      { response: "ACCEPTED", notes: "Receiving team confirmed." },
      { headers: { Authorization: expect.stringContaining("coordinator-token") } }
    );
    expect(client.patch).toHaveBeenNthCalledWith(
      2,
      `/relief-operations/dispatches/${dispatchId}/depart`,
      {},
      { headers: { Authorization: expect.stringContaining("coordinator-token") } }
    );
  });

  it("surfaces server-side failures instead of treating failed requests as success", async () => {
    client.get.mockRejectedValueOnce(new Error("Dispatch register unavailable"));

    await expect(fetchDispatches("coordinator-token")).rejects.toThrow(
      "Dispatch register unavailable"
    );
  });

  it("submits allocation-item trip quantities, manual checkpoints, and delivery accounting", async () => {
    const assignment = { id: "assignment-1", status: "ASSIGNED" };
    const checkpoint = { id: "tracking-1", location_label: "Jaffna checkpoint" };
    const dispatch = { id: dispatchId, status: "DELIVERED" };
    const assignmentInput = {
      teamProfileId: "55555555-5555-4555-8555-555555555555",
      tripNumber: 1,
      items: [{
        allocationItemId: "44444444-4444-4444-8444-444444444444",
        quantityDispatched: 10,
      }],
    };
    const deliveryInput = {
      receiverName: "Kamal Perera",
      condition: "PARTIAL" as const,
      items: [{
        dispatchItemId: "66666666-6666-4666-8666-666666666666",
        quantityReceived: 7,
        quantityDamaged: 1,
        quantityMissing: 2,
      }],
    };
    client.post
      .mockResolvedValueOnce({ data: { assignment } } as never)
      .mockResolvedValueOnce({ data: { tracking: checkpoint } } as never)
      .mockResolvedValueOnce({ data: { dispatch } } as never);

    await expect(assignDispatchTrip("coordinator-token", dispatchId, assignmentInput)).resolves.toEqual(assignment);
    await expect(recordDispatchTracking("coordinator-token", dispatchId, {
      locationLabel: "Jaffna checkpoint",
      latitude: 9.6615,
      longitude: 80.0255,
      notes: "Road clear.",
    })).resolves.toEqual(checkpoint);
    await expect(confirmDispatchDelivery("coordinator-token", dispatchId, deliveryInput)).resolves.toEqual(dispatch);

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      `/relief-operations/dispatches/${dispatchId}/assignments`,
      assignmentInput,
      { headers: { Authorization: expect.stringContaining("coordinator-token") } }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      `/relief-operations/dispatches/${dispatchId}/tracking`,
      { locationLabel: "Jaffna checkpoint", latitude: 9.6615, longitude: 80.0255, notes: "Road clear." },
      { headers: { Authorization: expect.stringContaining("coordinator-token") } }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      3,
      `/relief-operations/dispatches/${dispatchId}/delivery-confirmation`,
      deliveryInput,
      { headers: { Authorization: expect.stringContaining("coordinator-token") } }
    );
  });
});
