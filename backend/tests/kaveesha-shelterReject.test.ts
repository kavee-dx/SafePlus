import {
  getGroupForDispatch,
  markGroupRejectedByLeader,
} from "../services/kaveesha-shelterService";
import * as shelterRepo from "../repositories/kaveesha-shelterRepository";
import { withTransaction } from "../repositories/registrationRepository";
import { publishDispatchEvent } from "../services/kaveesha-dispatchEvents";
import type { EvacueeGroup } from "../models/kaveesha-shelter";

/* ------------------------------------------------------------------ *
 * A team leader declining the assigned shelter (UC-03 handoff).
 *
 * When the beds the district reserved do not work, the leader's decline has to
 * free the live reservations (so capacity is not held hostage), drop the group
 * into a distinct still-open DECLINED state the officer can act on, and leave a
 * group that is not ALLOCATED entirely alone. These drive the real service
 * against mocked repositories — the fake client only records the SQL it is given.
 * ------------------------------------------------------------------ */

jest.mock("../config/db");
jest.mock("../services/kaveesha-dispatchEvents");
jest.mock("../services/kaveesha-leaderPushService");
jest.mock("../repositories/kaveesha-shelterRepository");
jest.mock("../repositories/registrationRepository", () => ({
  insertUser: jest.fn(),
  withTransaction: jest.fn(),
}));

const findGroupByDispatch = shelterRepo.findGroupByDispatch as unknown as jest.Mock;
const findGroup = shelterRepo.findGroup as unknown as jest.Mock;
const setGroupStatus = shelterRepo.setGroupStatus as unknown as jest.Mock;
const insertEvent = shelterRepo.insertEvent as unknown as jest.Mock;
const runTransaction = withTransaction as unknown as jest.Mock;

const clientQuery = jest.fn();
const dispatchId = "22222222-2222-4222-8222-222222222222";

function allocation(
  overrides: Partial<EvacueeGroup["allocations"][number]>
): EvacueeGroup["allocations"][number] {
  return {
    id: "alloc-1",
    groupId: "group-1",
    shelterId: "shelter-1",
    shelterCode: "SH-1",
    shelterName: "Town Hall",
    allocatedCount: 5,
    arrivedCount: 0,
    status: "PENDING",
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    ...overrides,
  };
}

function group(overrides: Partial<EvacueeGroup> = {}): EvacueeGroup {
  return {
    id: "group-1",
    groupCode: "GRP-0001",
    peopleCount: 10,
    vulnerableCount: 0,
    arrivalSource: "RESCUE_TEAM",
    district: "Colombo",
    status: "ALLOCATED",
    allocations: [],
    ...overrides,
  } as EvacueeGroup;
}

beforeEach(() => {
  jest.clearAllMocks();
  clientQuery.mockResolvedValue({ rowCount: 1 });
  runTransaction.mockImplementation((work: (client: unknown) => Promise<unknown>) =>
    work({ query: clientQuery })
  );
});

describe("markGroupRejectedByLeader", () => {
  it("does nothing when the mission has no group", async () => {
    findGroupByDispatch.mockResolvedValue(null);

    await expect(markGroupRejectedByLeader(dispatchId)).resolves.toBeNull();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("leaves a group that is not ALLOCATED exactly as it was", async () => {
    const inTransit = group({ status: "IN_TRANSIT" });
    findGroupByDispatch.mockResolvedValue(inTransit);

    const result = await markGroupRejectedByLeader(dispatchId);

    expect(result).toEqual(inTransit);
    expect(runTransaction).not.toHaveBeenCalled();
    expect(setGroupStatus).not.toHaveBeenCalled();
  });

  it("frees the pending beds, logs each, and drops the group to DECLINED", async () => {
    findGroupByDispatch.mockResolvedValue(
      group({
        status: "ALLOCATED",
        allocations: [
          allocation({ id: "a1", shelterId: "s1", status: "PENDING" }),
          allocation({ id: "a2", shelterId: "s2", status: "PENDING" }),
          allocation({ id: "a3", shelterId: "s3", status: "CANCELLED" }),
        ],
      })
    );
    findGroup.mockResolvedValue(group({ status: "DECLINED" }));

    const result = await markGroupRejectedByLeader(dispatchId);

    expect(result?.status).toBe("DECLINED");
    // Only the two live reservations are stood down, never the already-cancelled one.
    expect(clientQuery).toHaveBeenCalledTimes(2);
    expect(insertEvent).toHaveBeenCalledTimes(2);
    expect(setGroupStatus).toHaveBeenCalledWith(expect.anything(), "group-1", "DECLINED");
    // The district is told, exactly once, that a reassignment is owed.
    expect(publishDispatchEvent).toHaveBeenCalledTimes(1);
  });
});

describe("getGroupForDispatch", () => {
  it("reads the group back without writing anything", async () => {
    const allocated = group({ status: "ALLOCATED" });
    findGroupByDispatch.mockResolvedValue(allocated);

    const result = await getGroupForDispatch(dispatchId);

    expect(result).toEqual(allocated);
    expect(runTransaction).not.toHaveBeenCalled();
    expect(setGroupStatus).not.toHaveBeenCalled();
  });
});
