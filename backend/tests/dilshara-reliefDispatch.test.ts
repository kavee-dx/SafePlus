import pool from "../config/db";
import {
  addTrackingUpdate,
  confirmDelivery,
  createAssignment,
  createDispatch,
  getDispatch,
  respondToDispatch,
  updateDispatchStatus,
} from "../repositories/dildhara-reliefDispatchRepository";
import { assignDispatchTrip } from "../services/dildhara-reliefDispatchService";

jest.mock("../config/db");

const database = pool as unknown as {
  connect: jest.Mock;
  query: jest.Mock;
};
database.connect = jest.fn();

const allocationId = "11111111-1111-4111-8111-111111111111";
const dispatchId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const allocationItemId = "44444444-4444-4444-8444-444444444444";
const teamId = "55555555-5555-4555-8555-555555555555";

function result(rows: unknown[] = [], rowCount = rows.length) {
  return { rows, rowCount };
}

let query: jest.Mock;
let release: jest.Mock;

function useTransaction() {
  query = jest.fn();
  release = jest.fn();
  database.connect.mockResolvedValue({ query, release });
}

function stubDispatchDetails(status: string) {
  database.query
    .mockResolvedValueOnce(result([{
      id: dispatchId,
      allocation_id: allocationId,
      status,
      agency_response: status === "READY" ? "ACCEPTED" : "REJECTED",
      destination_name: "North Relief Centre",
    }], 1))
    .mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result());
}

beforeEach(() => {
  jest.clearAllMocks();
  useTransaction();
});

describe("relief dispatch workflow", () => {
  it("creates a planned dispatch only for a RESERVED allocation", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{ id: allocationId, status: "RESERVED" }], 1))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{ id: dispatchId, status: "PLANNED" }], 1))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result());

    const dispatch = await createDispatch(allocationId, userId);

    expect(dispatch).toMatchObject({ id: dispatchId, status: "PLANNED" });
    expect(query).toHaveBeenLastCalledWith("COMMIT");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("relief_dispatch_tracking"))).toBe(true);
  });

  it("rejects dispatch creation for an allocation that is not RESERVED", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{ id: allocationId, status: "DRAFT" }], 1));

    await expect(createDispatch(allocationId, userId)).rejects.toMatchObject({
      status: 409,
      message: "Only reserved allocations can be dispatched.",
    });

    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("records agency rejection and cancels the reserved allocation", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{
        id: dispatchId,
        allocation_id: allocationId,
        status: "PLANNED",
        agency_response: "PENDING",
      }], 1))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result());
    stubDispatchDetails("CANCELLED");

    const dispatch = await respondToDispatch(
      dispatchId,
      userId,
      "REJECTED",
      "The receiving centre is closed."
    );

    expect(dispatch.status).toBe("CANCELLED");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET agency_response = 'REJECTED'"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET status = 'CANCELLED'") && String(sql).includes("relief_allocations"))).toBe(true);
    expect(query).toHaveBeenCalledWith("COMMIT");
  });

  it("records agency acceptance and advances a planned dispatch to READY", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{
        id: dispatchId,
        allocation_id: allocationId,
        status: "PLANNED",
        agency_response: "PENDING",
      }], 1))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result());
    stubDispatchDetails("READY");

    const dispatch = await respondToDispatch(
      dispatchId,
      userId,
      "ACCEPTED",
      "Receiving team confirmed."
    );

    expect(dispatch).toMatchObject({ status: "READY", agency_response: "ACCEPTED" });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET agency_response = 'ACCEPTED'"))).toBe(true);
    expect(query).toHaveBeenCalledWith("COMMIT");
  });

  it("does not allow departure before agency acceptance and an assignment", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{
        id: dispatchId,
        allocation_id: allocationId,
        status: "READY",
        agency_response: "PENDING",
      }], 1));

    await expect(updateDispatchStatus(dispatchId, userId, "IN_TRANSIT")).rejects.toMatchObject({
      status: 409,
      message: "The agency must accept the dispatch before departure.",
    });

    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("relief_dispatch_assignments"))).toBe(false);
  });

  it("marks an accepted dispatch in transit when at least one assignment exists", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{
        id: dispatchId,
        allocation_id: allocationId,
        status: "READY",
        agency_response: "ACCEPTED",
      }], 1))
      .mockResolvedValueOnce(result([{ id: "assignment-1" }], 1))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result());
    stubDispatchDetails("IN_TRANSIT");

    const dispatch = await updateDispatchStatus(dispatchId, userId, "IN_TRANSIT");

    expect(dispatch.status).toBe("IN_TRANSIT");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET status = 'DISPATCHED'"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET status = 'EN_ROUTE'"))).toBe(true);
    expect(query).toHaveBeenCalledWith("COMMIT");
  });

  it("allows manual tracking only while a dispatch is IN_TRANSIT", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{ status: "READY" }], 1));

    await expect(addTrackingUpdate(dispatchId, userId, {
      locationLabel: "Jaffna checkpoint",
      notes: "Road clear.",
    })).rejects.toMatchObject({
      status: 409,
      message: "Tracking updates require an in-transit dispatch.",
    });

    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("persists a manual checkpoint for an in-transit dispatch", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{ status: "IN_TRANSIT" }], 1))
      .mockResolvedValueOnce(result([{
        id: "tracking-2",
        dispatch_id: dispatchId,
        location_label: "Jaffna checkpoint",
        latitude: 9.6615,
        longitude: 80.0255,
        notes: "Road clear.",
      }], 1))
      .mockResolvedValueOnce(result());

    const checkpoint = await addTrackingUpdate(dispatchId, userId, {
      locationLabel: "Jaffna checkpoint",
      latitude: 9.6615,
      longitude: 80.0255,
      notes: "Road clear.",
    });

    expect(checkpoint).toMatchObject({
      id: "tracking-2",
      location_label: "Jaffna checkpoint",
      latitude: 9.6615,
      longitude: 80.0255,
    });
    expect(query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("rejects non-positive assignment quantities before attempting persistence", async () => {
    await expect(assignDispatchTrip(dispatchId, {
      tripNumber: 1,
      items: [{
        allocationItemId: "44444444-4444-4444-8444-444444444444",
        quantityDispatched: 0,
      }],
    })).rejects.toMatchObject({
      status: 400,
      message: "Dispatched quantities must be positive numbers.",
    });

    expect(database.connect).not.toHaveBeenCalled();
  });

  it("assigns a registered team and persists valid allocation item quantities", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{
        status: "READY",
        allocation_id: allocationId,
      }], 1))
      .mockResolvedValueOnce(result([{ id: teamId }], 1))
      .mockResolvedValueOnce(result([{ id: "assignment-1", status: "ASSIGNED" }], 1))
      .mockResolvedValueOnce(result([{ id: allocationItemId, quantity: 10 }], 1))
      .mockResolvedValueOnce(result([{ total: 6 }], 1))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result());

    const assignment = await createAssignment(dispatchId, {
      teamProfileId: teamId,
      tripNumber: 1,
      items: [{ allocationItemId, quantityDispatched: 4 }],
    });

    expect(assignment).toMatchObject({ id: "assignment-1", status: "ASSIGNED" });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("delivery_volunteer_teams"))).toBe(true);
    expect(query.mock.calls.some(([sql, params]) =>
      String(sql).includes("INSERT INTO relief_dispatch_items") &&
      params[2] === allocationItemId &&
      params[3] === 4
    )).toBe(true);
    expect(query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("rejects an assignment that exceeds the remaining allocation quantity", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{
        status: "READY",
        allocation_id: allocationId,
      }], 1))
      .mockResolvedValueOnce(result([{ id: teamId }], 1))
      .mockResolvedValueOnce(result([{ id: "assignment-1" }], 1))
      .mockResolvedValueOnce(result([{ id: allocationItemId, quantity: 10 }], 1))
      .mockResolvedValueOnce(result([{ total: 8 }], 1));

    await expect(createAssignment(dispatchId, {
      teamProfileId: teamId,
      tripNumber: 2,
      items: [{ allocationItemId, quantityDispatched: 3 }],
    })).rejects.toMatchObject({
      status: 409,
      message: "The total dispatched quantity cannot exceed the allocated quantity.",
    });

    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO relief_dispatch_items"))).toBe(false);
  });

  it("requires delivery quantities to account for the full dispatched amount", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{ status: "IN_TRANSIT" }], 1))
      .mockResolvedValueOnce(result([{ id: "dispatch-item-1" }], 1))
      .mockResolvedValueOnce(result([{
        id: "dispatch-item-1",
        quantity_dispatched: 10,
        dispatch_id: dispatchId,
      }], 1));

    await expect(confirmDelivery(dispatchId, userId, {
      receiverName: "Kamal Perera",
      condition: "PARTIAL",
      items: [{
        dispatchItemId: "dispatch-item-1",
        quantityReceived: 7,
        quantityDamaged: 1,
        quantityMissing: 1,
      }],
    })).rejects.toMatchObject({
      status: 400,
      message: "Received, damaged, and missing quantities must account for the full dispatched quantity.",
    });

    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO relief_delivery_confirmations"))).toBe(false);
  });

  it("persists receiver and item quantities and completes a fully delivered dispatch", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{
        id: dispatchId,
        allocation_id: allocationId,
        status: "IN_TRANSIT",
      }], 1))
      .mockResolvedValueOnce(result([{ id: "dispatch-item-1" }], 1))
      .mockResolvedValueOnce(result([{
        id: "dispatch-item-1",
        quantity_dispatched: 10,
        dispatch_id: dispatchId,
      }], 1))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{ count: 0 }], 1))
      .mockResolvedValueOnce(result([{
        allocation_item_id: "allocation-item-1",
        allocated_quantity: 10,
        received_quantity: 10,
      }], 1))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result());
    database.query
      .mockResolvedValueOnce(result([{
        id: dispatchId,
        allocation_id: allocationId,
        status: "DELIVERED",
      }], 1))
      .mockResolvedValueOnce(result([{ id: "assignment-1" }], 1))
      .mockResolvedValueOnce(result([{ id: "tracking-1" }], 1))
      .mockResolvedValueOnce(result([{
        id: "confirmation-1",
        receiver_name: "Kamal Perera",
        delivery_condition: "ACCEPTED",
      }], 1))
      .mockResolvedValueOnce(result([{ id: "dispatch-item-1", quantity_received: 10 }], 1));

    const dispatch = await confirmDelivery(dispatchId, userId, {
      receiverName: "Kamal Perera",
      condition: "ACCEPTED",
      items: [{
        dispatchItemId: "dispatch-item-1",
        quantityReceived: 10,
        quantityDamaged: 0,
        quantityMissing: 0,
      }],
    });

    expect(dispatch.status).toBe("DELIVERED");
    expect(dispatch.deliveryConfirmations[0].receiver_name).toBe("Kamal Perera");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET status = 'COMPLETED'") && String(sql).includes("relief_allocations"))).toBe(true);
    expect(query).toHaveBeenCalledWith("COMMIT");
  });

  it("retrieves saved dispatch details and related register records on reopening", async () => {
    database.query
      .mockResolvedValueOnce(result([{
        id: dispatchId,
        allocation_id: allocationId,
        status: "IN_TRANSIT",
      }], 1))
      .mockResolvedValueOnce(result([{ id: "assignment-1" }], 1))
      .mockResolvedValueOnce(result([{ id: "tracking-1", location_label: "Jaffna checkpoint" }], 1))
      .mockResolvedValueOnce(result([{ id: "confirmation-1" }], 1))
      .mockResolvedValueOnce(result([{ id: "item-1", quantity_dispatched: 4 }], 1));

    await expect(getDispatch(dispatchId)).resolves.toMatchObject({
      id: dispatchId,
      status: "IN_TRANSIT",
      assignments: [{ id: "assignment-1" }],
      tracking: [{ location_label: "Jaffna checkpoint" }],
      deliveryConfirmations: [{ id: "confirmation-1" }],
      items: [{ quantity_dispatched: 4 }],
    });
  });
});
