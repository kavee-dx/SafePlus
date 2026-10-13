import { ensureGroupForDispatch } from "../services/kaveesha-shelterService";
import * as shelterRepo from "../repositories/kaveesha-shelterRepository";
import { withTransaction } from "../repositories/registrationRepository";
import { publishDispatchEvent } from "../services/kaveesha-dispatchEvents";
import type { DispatchRoll } from "../models/kaveesha-rescueDispatch";
import type { EvacueeGroup } from "../models/kaveesha-shelter";
import { ApiError } from "../utils/apiError";

/* ------------------------------------------------------------------ *
 * The pre-completion shelter request (UC-03 + shelter coordination).
 *
 * A district officer can now raise a mission's shelter need while the team is
 * still working, so ensureGroupForDispatch has to be idempotent, correct a
 * wrong headcount before anyone is allocated, fall back to the reported
 * headcount when the officer sends none, and refuse a request that cannot say
 * how many people it is for. These tests drive the real service against mocked
 * repositories — no live database, no invented rows past what a query returns.
 * ------------------------------------------------------------------ */

jest.mock("../config/db");
jest.mock("../services/kaveesha-dispatchEvents");
jest.mock("../repositories/kaveesha-shelterRepository");
jest.mock("../repositories/registrationRepository", () => ({
  insertUser: jest.fn(),
  // The service only needs the callback to run; the fake client is never read.
  withTransaction: jest.fn((work: (client: unknown) => Promise<unknown>) =>
    work({})
  ),
}));

const findGroupByDispatch = (shelterRepo.findGroupByDispatch as unknown as jest.Mock);
const findGroup = (shelterRepo.findGroup as unknown as jest.Mock);
const insertGroup = (shelterRepo.insertGroup as unknown as jest.Mock);
const setGroupPeopleCount = (shelterRepo.setGroupPeopleCount as unknown as jest.Mock);
const runTransaction = withTransaction as unknown as jest.Mock;

const dispatchId = "22222222-2222-4222-8222-222222222222";

function roll(overrides: Partial<DispatchRoll> = {}): DispatchRoll {
  return {
    id: dispatchId,
    dispatchCode: "DSP-0001",
    district: "Colombo",
    peopleRescued: 0,
    peopleEvacuated: 0,
    reportId: "rep-1",
    incidentLat: 6.9271,
    incidentLng: 79.8612,
    ...overrides,
  } as DispatchRoll;
}

function group(overrides: Partial<EvacueeGroup> = {}): EvacueeGroup {
  return {
    id: "group-1",
    groupCode: "GRP-0001",
    peopleCount: 10,
    vulnerableCount: 0,
    arrivalSource: "RESCUE_TEAM",
    district: "Colombo",
    status: "AWAITING_SHELTER",
    allocations: [],
    ...overrides,
  } as EvacueeGroup;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ensureGroupForDispatch", () => {
  it("returns the existing group untouched when no headcount is given", async () => {
    const existing = group();
    findGroupByDispatch.mockResolvedValue(existing);

    const result = await ensureGroupForDispatch(roll());

    expect(result).toEqual(existing);
    // Idempotent: an already-awaited group is neither resized nor duplicated.
    expect(setGroupPeopleCount).not.toHaveBeenCalled();
    expect(insertGroup).not.toHaveBeenCalled();
  });

  it("corrects the headcount while the group is still awaiting shelter", async () => {
    findGroupByDispatch
      .mockResolvedValueOnce(group({ peopleCount: 10 }))
      .mockResolvedValue(null);
    findGroup.mockResolvedValue(group({ peopleCount: 12 }));

    const result = await ensureGroupForDispatch(roll(), 12);

    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(setGroupPeopleCount).toHaveBeenCalledWith(expect.anything(), "group-1", 12);
    expect(result.peopleCount).toBe(12);
    expect(insertGroup).not.toHaveBeenCalled();
  });

  it("creates a group from the reported headcount when the officer sends none", async () => {
    findGroupByDispatch.mockResolvedValue(null);
    insertGroup.mockResolvedValue("new-group");
    findGroup.mockResolvedValue(group({ id: "new-group", peopleCount: 8 }));

    const result = await ensureGroupForDispatch(
      roll({ peopleRescued: 8, peopleEvacuated: 3 })
    );

    expect(insertGroup).toHaveBeenCalledTimes(1);
    const created = insertGroup.mock.calls[0][1] as { peopleCount: number };
    // The larger of rescued/evacuated is the honest count of people to shelter.
    expect(created.peopleCount).toBe(8);
    expect(result.id).toBe("new-group");
    expect(publishDispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("prefers the officer's explicit count over the reported headcount", async () => {
    findGroupByDispatch.mockResolvedValue(null);
    insertGroup.mockResolvedValue("new-group");
    findGroup.mockResolvedValue(group({ id: "new-group", peopleCount: 20 }));

    await ensureGroupForDispatch(roll({ peopleRescued: 8 }), 20);

    const created = insertGroup.mock.calls[0][1] as { peopleCount: number };
    expect(created.peopleCount).toBe(20);
  });

  it("refuses to invent a headcount when nothing was reported", async () => {
    findGroupByDispatch.mockResolvedValue(null);

    await expect(ensureGroupForDispatch(roll())).rejects.toBeInstanceOf(ApiError);
    expect(insertGroup).not.toHaveBeenCalled();
  });

  it("refuses a mission with no district to shelter in", async () => {
    findGroupByDispatch.mockResolvedValue(null);

    await expect(
      ensureGroupForDispatch(roll({ district: undefined as unknown as string }), 5)
    ).rejects.toBeInstanceOf(ApiError);
    expect(insertGroup).not.toHaveBeenCalled();
  });
});
