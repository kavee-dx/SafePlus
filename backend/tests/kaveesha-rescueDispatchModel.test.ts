import {
  allowedNextStatuses,
  isLiveDispatch,
  liveDispatchStatuses,
  LIVE_DISPATCH_STATUSES,
  CLOSED_DISPATCH_STATUSES,
  DISPATCH_STATUSES,
} from "../models/kaveesha-rescueDispatch";

describe("allowedNextStatuses", () => {
  it("lets a leader accept or decline a fresh tasking", () => {
    expect(allowedNextStatuses("DISPATCHED", "LEADER")).toEqual(["ACCEPTED", "DECLINED"]);
  });

  it("lets a leader return from the field and then complete", () => {
    expect(allowedNextStatuses("RETURNING", "LEADER")).toEqual(["COMPLETED"]);
  });

  it("lets a leader finish early once arrived or engaged", () => {
    expect(allowedNextStatuses("ARRIVED", "LEADER")).toContain("COMPLETED");
    expect(allowedNextStatuses("RESCUE_IN_PROGRESS", "LEADER")).toContain("COMPLETED");
  });

  it("never lets a leader move a finished mission", () => {
    expect(allowedNextStatuses("COMPLETED", "LEADER")).toEqual([]);
    expect(allowedNextStatuses("DECLINED", "LEADER")).toEqual([]);
    expect(allowedNextStatuses("CANCELLED", "LEADER")).toEqual([]);
  });

  it("lets an officer stand a live mission down", () => {
    expect(allowedNextStatuses("EN_ROUTE", "OFFICER")).toEqual(["CANCELLED"]);
    expect(allowedNextStatuses("DISPATCHED", "OFFICER")).toContain("DECLINED");
  });

  it("gives an officer no move on a closed mission", () => {
    expect(allowedNextStatuses("COMPLETED", "OFFICER")).toEqual([]);
  });

  it("returns a fresh array that cannot mutate the shared table", () => {
    const first = allowedNextStatuses("ACCEPTED", "LEADER");
    first.push("COMPLETED");
    expect(allowedNextStatuses("ACCEPTED", "LEADER")).toEqual(["EN_ROUTE", "CANCELLED"]);
  });

  it("falls back to an empty list for an unknown stage", () => {
    expect(allowedNextStatuses("NOT_A_STAGE" as never, "LEADER")).toEqual([]);
    expect(allowedNextStatuses("NOT_A_STAGE" as never, "OFFICER")).toEqual([]);
  });
});

describe("isLiveDispatch", () => {
  it("treats every still-holding stage as live", () => {
    for (const status of LIVE_DISPATCH_STATUSES) {
      expect(isLiveDispatch(status)).toBe(true);
    }
  });

  it("treats every finished stage as not live", () => {
    for (const status of CLOSED_DISPATCH_STATUSES) {
      expect(isLiveDispatch(status)).toBe(false);
    }
  });

  it("partitions the full status list with no overlap", () => {
    const live = new Set<string>(LIVE_DISPATCH_STATUSES);
    const closed = new Set<string>(CLOSED_DISPATCH_STATUSES);

    for (const status of CLOSED_DISPATCH_STATUSES) {
      expect(live.has(status)).toBe(false);
    }

    expect(live.size + closed.size).toBe(DISPATCH_STATUSES.length);
  });
});

describe("liveDispatchStatuses", () => {
  it("returns the live stages as an independent copy", () => {
    const copy = liveDispatchStatuses();
    expect(copy).toEqual(LIVE_DISPATCH_STATUSES);

    copy.length = 0;
    expect(LIVE_DISPATCH_STATUSES).toHaveLength(6);
  });
});
