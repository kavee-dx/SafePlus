import { describe, expect, it } from "vitest";

import {
  DISASTER_KINDS,
  FORCE_COVER,
  answersDisaster,
  disasterTerms,
  teamsForDisaster,
} from "../src/constants/kaveesha-disasterKinds";
import type { DistrictTeamCard } from "../src/services/kaveesha-districtTeamsApi";

function team(overrides: Partial<DistrictTeamCard>): DistrictTeamCard {
  return {
    userId: "u-1",
    teamName: "Team",
    teamType: "Flood Rescue",
    district: "Colombo",
    outsideDistrict: false,
    availability: "AVAILABLE",
    members: 6,
    contactNumber: "0770000000",
    capabilities: [],
    equipment: [],
    ...overrides,
  } as DistrictTeamCard;
}

describe("disasterTerms", () => {
  it("splits a multi-word label into its meaningful lower-cased words", () => {
    expect(disasterTerms("Heavy rain")).toEqual(["heavy", "rain"]);
    expect(disasterTerms("Coastal erosion")).toEqual(["coastal", "erosion"]);
  });

  it("drops one and two letter fragments so short noise never matches", () => {
    expect(disasterTerms("Fire & Rescue")).toEqual(["fire", "rescue"]);
    expect(disasterTerms("A to Z")).toEqual([]);
  });

  it("strips punctuation and returns nothing for a label with no long word", () => {
    expect(disasterTerms("!! ?? ..")).toEqual([]);
    expect(disasterTerms("")).toEqual([]);
  });
});

describe("answersDisaster", () => {
  it("matches a team whose discipline names the disaster", () => {
    const crew = team({ teamType: "Flood Rescue", capabilities: [] });

    expect(answersDisaster(crew, disasterTerms("Flood"))).toBe(true);
  });

  it("matches a team whose capability names the disaster even if the type does not", () => {
    const crew = team({ teamType: "Search & Rescue", capabilities: ["Landslide Rescue"] });

    expect(answersDisaster(crew, disasterTerms("Landslide"))).toBe(true);
    expect(answersDisaster(crew, disasterTerms("Flood"))).toBe(false);
  });

  it("counts a Multi-Hazard team against any disaster", () => {
    const crew = team({ teamType: "Multi-Hazard Rescue", capabilities: [] });

    expect(answersDisaster(crew, disasterTerms("Cyclone"))).toBe(true);
    expect(answersDisaster(crew, disasterTerms("Drought"))).toBe(true);
    expect(answersDisaster(crew, [])).toBe(true);
  });

  it("is case insensitive about the registered names", () => {
    const crew = team({ teamType: "FLOOD RESCUE", capabilities: ["Evacuation"] });

    expect(answersDisaster(crew, disasterTerms("Flood"))).toBe(true);
  });

  it("rejects a team unrelated to the disaster", () => {
    const crew = team({ teamType: "Medical Rescue", capabilities: ["Evacuation"] });

    expect(answersDisaster(crew, disasterTerms("Wildfire"))).toBe(false);
  });
});

describe("teamsForDisaster", () => {
  const roster = [
    team({ userId: "a", teamType: "Flood Rescue" }),
    team({ userId: "b", teamType: "Fire & Rescue" }),
    team({ userId: "c", teamType: "Medical Rescue" }),
    team({ userId: "d", teamType: "Multi-Hazard Rescue" }),
  ];

  it("returns every team that answers the disaster, keeping order", () => {
    const flood = DISASTER_KINDS.find((k) => k.code === "FLOOD")!;

    expect(teamsForDisaster(roster, flood).map((t) => t.userId)).toEqual(["a", "d"]);
  });

  it("pulls in only the multi-hazard crew for a disaster nobody else covers", () => {
    const cyclone = DISASTER_KINDS.find((k) => k.code === "CYCLONE")!;

    expect(teamsForDisaster(roster, cyclone).map((t) => t.userId)).toEqual(["d"]);
  });

  it("returns an empty list when no team and no multi-hazard crew exists", () => {
    const drought = DISASTER_KINDS.find((k) => k.code === "DROUGHT")!;
    const floodOnly = [team({ teamType: "Flood Rescue" })];

    expect(teamsForDisaster(floodOnly, drought)).toEqual([]);
  });

  it("handles an empty roster without throwing", () => {
    const flood = DISASTER_KINDS.find((k) => k.code === "FLOOD")!;

    expect(teamsForDisaster([], flood)).toEqual([]);
  });
});

describe("DISASTER_KINDS", () => {
  it("exposes a unique code and a citizen-facing label for each hazard", () => {
    const codes = DISASTER_KINDS.map((k) => k.code);

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain("FLOOD");
    expect(DISASTER_KINDS.every((k) => k.label.length > 0)).toBe(true);
  });
});

describe("FORCE_COVER", () => {
  it("gives each state a solid and a light colour so bars and dots match", () => {
    expect(FORCE_COVER.available).not.toBe(FORCE_COVER.deployed);
    expect(FORCE_COVER.deployed).not.toBe(FORCE_COVER.resting);
    expect(Object.values(FORCE_COVER).every((hex) => /^#[0-9A-Fa-f]{6}$/.test(hex))).toBe(true);
  });
});
