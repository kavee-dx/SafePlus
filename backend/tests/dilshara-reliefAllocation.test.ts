import pool from "../config/db";
import { ApiError } from "../utils/apiError";
import {
  createDraftAllocation,
  reserveAllocation,
} from "../repositories/dildhara-reliefAllocationRepository";
import {
  createAllocation,
} from "../services/dildhara-reliefAllocationService";

jest.mock("../config/db");

const database = pool as unknown as {
  connect: jest.Mock;
  query: jest.Mock;
};
database.connect = jest.fn();

const allocationId = "11111111-1111-4111-8111-111111111111";
const resourceId = "22222222-2222-4222-8222-222222222222";
const coordinatorId = "33333333-3333-4333-8333-333333333333";

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

function reserveResults(available: number, allocated: number) {
  query
    .mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result([{ id: allocationId, status: "DRAFT", allocation_type: "AREA" }], 1))
    .mockResolvedValueOnce(result([{ resource_id: resourceId, quantity: 4 }], 1))
    .mockResolvedValueOnce(result([{ id: resourceId }], 1))
    .mockResolvedValueOnce(result([{
      id: resourceId,
      quantity: available + allocated,
      allocated_quantity: allocated,
      eligible: true,
    }], 1));
}

beforeEach(() => {
  jest.clearAllMocks();
  useTransaction();
});

describe("relief allocation workflow", () => {
  it("persists a new allocation as DRAFT without reserving stock", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{ id: allocationId, status: "DRAFT" }], 1))
      .mockResolvedValueOnce(result([{ id: resourceId, resource_name: "Water", unit: "litres" }], 1))
      .mockResolvedValueOnce(result());

    const allocation = await createDraftAllocation(coordinatorId, {
      allocationType: "AREA",
      destinationName: "North Relief Centre",
      destinationLocation: "Jaffna",
      destinationDistrict: "Jaffna",
      items: [{ resourceId, quantity: 4 }],
    });

    expect(allocation).toMatchObject({ id: allocationId, status: "DRAFT" });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET status = 'RESERVED'"))).toBe(false);
    expect(query).toHaveBeenLastCalledWith("COMMIT");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("reserves an allocation when stock remaining after other reservations is sufficient", async () => {
    reserveResults(5, 3);
    query
      .mockResolvedValueOnce(result([{ id: allocationId, status: "RESERVED" }], 1))
      .mockResolvedValueOnce(result());

    const allocation = await reserveAllocation(allocationId);

    expect(allocation.status).toBe("RESERVED");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET status = 'RESERVED'"))).toBe(true);
    expect(query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("rolls back reservation when remaining stock is insufficient", async () => {
    reserveResults(2, 3);

    await expect(reserveAllocation(allocationId)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Insufficient stock"),
    } satisfies Partial<ApiError>);

    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET status = 'RESERVED'"))).toBe(false);
  });

  it("refuses to reserve an allocation that is not in DRAFT", async () => {
    query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{ id: allocationId, status: "DISPATCHED" }], 1));

    await expect(reserveAllocation(allocationId)).rejects.toMatchObject({
      status: 400,
      message: "Only draft allocations can be reserved.",
    });

    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("rejects invalid draft quantities before opening a database transaction", async () => {
    await expect(createAllocation(coordinatorId, {
      allocationType: "AREA",
      destinationName: "North Relief Centre",
      destinationLocation: "Jaffna",
      destinationDistrict: "Jaffna",
      items: [{ resourceId, quantity: 0 }],
    })).rejects.toBeInstanceOf(ApiError);

    expect(database.connect).not.toHaveBeenCalled();
  });
});
