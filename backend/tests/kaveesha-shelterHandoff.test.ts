import pool from "../config/db";
import { findPendingAssignmentForDispatch } from "../repositories/kaveesha-shelterRepository";
import {
  leaderAcksShelterAssignment,
  leaderRejectsShelterAssignment,
  readShelterGroupForDispatch,
} from "../services/kaveesha-dispatchService";
import * as dispatchRepo from "../repositories/kaveesha-dispatchRepository";
import * as shelterService from "../services/kaveesha-shelterService";
import { ApiError } from "../utils/apiError";

/* ------------------------------------------------------------------ *
 * The leader-side shelter handoff (UC-03).
 *
 * Two things must hold for a phone to drive a rescued group to its shelter:
 * the board can read the pending allocation back (findPendingAssignmentForDispatch),
 * and accepting it only moves a leader's OWN mission. These are the smallest tests
 * that would fail if either rule quietly broke.
 * ------------------------------------------------------------------ */

jest.mock("../config/db");
jest.mock("../repositories/kaveesha-dispatchRepository");
jest.mock("../services/kaveesha-shelterService");

const database = pool as unknown as { query: jest.Mock };

const team = (dispatchRepo.findTeamByUserId as unknown as jest.Mock) as jest.Mock;
const findDispatchById = (dispatchRepo.findDispatchById as unknown as jest.Mock) as jest.Mock;
const findLive = (dispatchRepo.findLiveDispatchForTeam as unknown as jest.Mock) as jest.Mock;
const markInTransit = (shelterService.markGroupInTransit as unknown as jest.Mock) as jest.Mock;
const markRejected = (shelterService.markGroupRejectedByLeader as unknown as jest.Mock) as jest.Mock;
const readGroup = (shelterService.getGroupForDispatch as unknown as jest.Mock) as jest.Mock;
const findRoll = (dispatchRepo.findDispatchRoll as unknown as jest.Mock) as jest.Mock;

const userId = "33333333-3333-4333-8333-333333333333";
const dispatchId = "22222222-2222-4222-8222-222222222222";
const teamId = "55555555-5555-4555-8555-555555555555";

function result(rows: unknown[]) {
  return { rows, rowCount: rows.length };
}

describe("findPendingAssignmentForDispatch", () => {
  it("returns an empty handoff when the mission has no group", async () => {
    database.query.mockResolvedValueOnce(result([]));

    const handoff = await findPendingAssignmentForDispatch(dispatchId);

    expect(handoff).toEqual({ groupStatus: null, assignments: [] });
    // No group means no second query for allocations.
    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it("maps the pending allocation to a shelter the phone can drive to", async () => {
    database.query
      .mockResolvedValueOnce(result([{ id: "group-1", status: "ALLOCATED" }]))
      .mockResolvedValueOnce(
        result([
          {
            shelter_id: "shelter-1",
            shelter_name: "Town Hall",
            shelter_latitude: 6.9271,
            shelter_longitude: 79.8612,
            allocated_count: 12,
          },
          {
            shelter_id: "shelter-2",
            shelter_name: "School Hall",
            shelter_latitude: null,
            shelter_longitude: null,
            allocated_count: 4,
          },
        ])
      );

    const handoff = await findPendingAssignmentForDispatch(dispatchId);

    expect(handoff.groupStatus).toBe("ALLOCATED");
    expect(handoff.assignments).toHaveLength(2);
    expect(handoff.assignments[0]).toEqual({
      shelterId: "shelter-1",
      name: "Town Hall",
      latitude: 6.9271,
      longitude: 79.8612,
      allocatedCount: 12,
    });
    // A shelter without saved coordinates is still returned, with a null point,
    // so the phone can show it but never pretend the map has a destination.
    expect(handoff.assignments[1]).toMatchObject({
      shelterId: "shelter-2",
      latitude: null,
      longitude: null,
    });
  });

  it("reports the group status even before any bed is allocated", async () => {
    database.query
      .mockResolvedValueOnce(result([{ id: "group-1", status: "AWAITING_SHELTER" }]))
      .mockResolvedValueOnce(result([]));

    const handoff = await findPendingAssignmentForDispatch(dispatchId);

    expect(handoff).toEqual({ groupStatus: "AWAITING_SHELTER", assignments: [] });
  });
});

describe("leaderAcksShelterAssignment", () => {
  it("404s when the account has no rescue team", async () => {
    team.mockResolvedValue(null);

    await expect(leaderAcksShelterAssignment(userId, dispatchId)).rejects.toBeInstanceOf(ApiError);
    expect(markInTransit).not.toHaveBeenCalled();
  });

  it("403s when the mission belongs to another team", async () => {
    team.mockResolvedValue({ teamId, teamName: "Alpha", availability: "ON_DEPLOYMENT" });
    findDispatchById.mockResolvedValue({ id: dispatchId, teamId: "other-team" });

    await expect(leaderAcksShelterAssignment(userId, dispatchId)).rejects.toBeInstanceOf(ApiError);
    expect(markInTransit).not.toHaveBeenCalled();
  });

  it("404s when there is no mission to resolve", async () => {
    team.mockResolvedValue({ teamId, teamName: "Alpha", availability: "ON_DEPLOYMENT" });
    findLive.mockResolvedValue(null);

    await expect(leaderAcksShelterAssignment(userId)).rejects.toBeInstanceOf(ApiError);
    expect(markInTransit).not.toHaveBeenCalled();
  });

  it("moves the leader's own group to IN_TRANSIT", async () => {
    const group = { id: "group-1", status: "IN_TRANSIT", groupCode: "GRP-1" };

    team.mockResolvedValue({ teamId, teamName: "Alpha", availability: "ON_DEPLOYMENT" });
    findDispatchById.mockResolvedValue({ id: dispatchId, teamId });
    markInTransit.mockResolvedValue(group);

    const outcome = await leaderAcksShelterAssignment(userId, dispatchId);

    expect(markInTransit).toHaveBeenCalledWith(dispatchId);
    expect(outcome.group).toEqual(group);
  });
});

describe("leaderRejectsShelterAssignment", () => {
  it("404s when the account has no rescue team", async () => {
    team.mockResolvedValue(null);

    await expect(
      leaderRejectsShelterAssignment(userId, dispatchId)
    ).rejects.toBeInstanceOf(ApiError);
    expect(markRejected).not.toHaveBeenCalled();
  });

  it("403s when the mission belongs to another team", async () => {
    team.mockResolvedValue({ teamId, teamName: "Alpha", availability: "ON_DEPLOYMENT" });
    findDispatchById.mockResolvedValue({ id: dispatchId, teamId: "other-team" });

    await expect(
      leaderRejectsShelterAssignment(userId, dispatchId)
    ).rejects.toBeInstanceOf(ApiError);
    expect(markRejected).not.toHaveBeenCalled();
  });

  it("declines the leader's own group so the district can reassign", async () => {
    const group = { id: "group-1", status: "DECLINED", groupCode: "GRP-1" };

    team.mockResolvedValue({ teamId, teamName: "Alpha", availability: "ON_DEPLOYMENT" });
    findDispatchById.mockResolvedValue({ id: dispatchId, teamId });
    markRejected.mockResolvedValue(group);

    const outcome = await leaderRejectsShelterAssignment(userId, dispatchId);

    expect(markRejected).toHaveBeenCalledWith(dispatchId);
    expect(outcome.group).toEqual(group);
  });
});

describe("readShelterGroupForDispatch", () => {
  const context = {
    userId,
    role: "DISTRICT_OFFICER",
    fullName: "Officer",
    district: "Colombo",
  };

  it("404s for a mission that does not exist", async () => {
    findRoll.mockResolvedValue(null);

    await expect(
      readShelterGroupForDispatch(context, dispatchId)
    ).rejects.toBeInstanceOf(ApiError);
    expect(readGroup).not.toHaveBeenCalled();
  });

  it("403s when the mission is in another district", async () => {
    findRoll.mockResolvedValue({ id: dispatchId, district: "Gampaha" });

    await expect(
      readShelterGroupForDispatch(context, dispatchId)
    ).rejects.toBeInstanceOf(ApiError);
    expect(readGroup).not.toHaveBeenCalled();
  });

  it("reads the group back for an in-scope mission without inventing one", async () => {
    const group = { id: "group-1", status: "IN_TRANSIT", groupCode: "GRP-1" };

    findRoll.mockResolvedValue({ id: dispatchId, district: "Colombo" });
    readGroup.mockResolvedValue(group);

    const result = await readShelterGroupForDispatch(context, dispatchId);

    expect(result).toEqual(group);
    expect(readGroup).toHaveBeenCalledWith(dispatchId);
  });

  it("returns null when the mission has no shelter group", async () => {
    findRoll.mockResolvedValue({ id: dispatchId, district: "Colombo" });
    readGroup.mockResolvedValue(null);

    await expect(readShelterGroupForDispatch(context, dispatchId)).resolves.toBeNull();
  });
});
