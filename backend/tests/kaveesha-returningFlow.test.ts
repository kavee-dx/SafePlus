import { advanceByLeader, leaderWorkspace } from "../services/kaveesha-dispatchService";
import * as dispatchRepo from "../repositories/kaveesha-dispatchRepository";
import { findPendingAssignmentForDispatch } from "../repositories/kaveesha-shelterRepository";
import * as shelterService from "../services/kaveesha-shelterService";

/* ------------------------------------------------------------------ *
 * The RETURNING handoff (UC-03 + shelter coordination).
 *
 * The headcount is now taken when the team marks itself Returning, so the
 * district can allocate a shelter while the mission is still live — and a
 * completed mission drops off the leader's board to history at once (the
 * shelter driving happens during RETURNING, not after). These guard both.
 * ------------------------------------------------------------------ */

jest.mock("../config/db");
jest.mock("../repositories/kaveesha-dispatchRepository");
jest.mock("../repositories/kaveesha-shelterRepository");
jest.mock("../services/kaveesha-shelterService");
jest.mock("../services/kaveesha-dispatchEvents");

const findTeam = dispatchRepo.findTeamByUserId as unknown as jest.Mock;
const findDispatchById = dispatchRepo.findDispatchById as unknown as jest.Mock;
const advance = dispatchRepo.advanceDispatchStatus as unknown as jest.Mock;
const readRoll = dispatchRepo.findDispatchRoll as unknown as jest.Mock;
const recordOutcome = dispatchRepo.recordOutcome as unknown as jest.Mock;
const listByTeam = dispatchRepo.listDispatchRollsByTeam as unknown as jest.Mock;
const findPhoto = dispatchRepo.findIncidentPhotoUrl as unknown as jest.Mock;
const pendingHandoff = findPendingAssignmentForDispatch as unknown as jest.Mock;
const makeGroup = shelterService.createGroupForCompletedDispatch as unknown as jest.Mock;

const userId = "33333333-3333-4333-8333-333333333333";
const dispatchId = "22222222-2222-4222-8222-222222222222";
const teamId = "55555555-5555-4555-8555-555555555555";

const team = { teamId, teamName: "Alpha", availability: "ON_DEPLOYMENT" };

function roll(overrides: Record<string, unknown> = {}) {
  return {
    id: dispatchId,
    dispatchCode: "DSP-0001",
    status: "RESCUE_IN_PROGRESS",
    district: "Colombo",
    teamId,
    teamName: "Alpha",
    reportId: "rep-1",
    reportPublicId: "RP-1",
    events: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // The scene photo is optional; resolve "none" so the board paint never throws.
  findPhoto.mockResolvedValue(null);
});

describe("advanceByLeader at RETURNING", () => {
  it("records the headcount and raises the shelter group before completion", async () => {
    findTeam.mockResolvedValue(team);
    findDispatchById.mockResolvedValue({ id: dispatchId, teamId, status: "RESCUE_IN_PROGRESS" });
    advance.mockResolvedValue({ dispatch: { teamId }, previousStatus: "RESCUE_IN_PROGRESS" });
    readRoll.mockResolvedValue(roll({ status: "RETURNING", peopleRescued: 9 }));

    await advanceByLeader({
      userId,
      role: "TEAM_LEADER",
      dispatchId,
      status: "RETURNING",
      peopleRescued: 9,
      peopleEvacuated: 2,
    });

    // The count lands on the mission while it is still live...
    expect(recordOutcome).toHaveBeenCalledWith(dispatchId, {
      peopleRescued: 9,
      peopleEvacuated: 2,
    });
    // ...and the shelter group is created from it, so the desk sees it now.
    expect(makeGroup).toHaveBeenCalledTimes(1);
    expect(makeGroup).toHaveBeenCalledWith(
      expect.objectContaining({ status: "RETURNING" })
    );
  });
});

describe("leaderWorkspace", () => {
  it("keeps a Returning mission live and paints its shelter assignment", async () => {
    findTeam.mockResolvedValue(team);
    listByTeam.mockResolvedValue([roll({ status: "RETURNING" })]);
    pendingHandoff.mockResolvedValue({
      groupStatus: "ALLOCATED",
      assignments: [{ shelterId: "s1", name: "Hall", latitude: 6.9, longitude: 79.8, allocatedCount: 9 }],
    });

    const board = await leaderWorkspace(userId);

    expect(board.active?.status).toBe("RETURNING");
    expect(board.active?.shelterAssignment).toHaveLength(1);
    expect(board.history.map((r) => r.id)).not.toContain(dispatchId);
  });

  it("moves a completed mission to history only, never back to active", async () => {
    findTeam.mockResolvedValue(team);
    listByTeam.mockResolvedValue([roll({ status: "COMPLETED", peopleRescued: 9 })]);

    const board = await leaderWorkspace(userId);

    // Even though the rescue is finished, the mission no longer pins the board —
    // the shelter driving happened during RETURNING.
    expect(board.active).toBeNull();
    expect(pendingHandoff).not.toHaveBeenCalled();
    expect(board.history.map((r) => r.id)).toContain(dispatchId);
  });
});
