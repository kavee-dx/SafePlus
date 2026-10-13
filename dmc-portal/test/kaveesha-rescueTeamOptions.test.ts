import { describe, expect, it } from "vitest";

import {
  CAPABILITY_ICONS,
  EQUIPMENT_ICONS,
  TEAM_CAPABILITIES,
  TEAM_EQUIPMENT,
  TEAM_TYPES,
  latitudeRule,
  listRule,
  longitudeRule,
  nicRule,
  oneOfRule,
  optionalListRule,
  teamTypeIcon,
  toList,
} from "../src/constants/kaveesha-rescueTeamOptions";
import type { Validator } from "../src/utils/dushani-registrationValidation";

const check = (validator: Validator) => (value: string): string | null =>
  validator(value, {});

const nic = check(nicRule);
const lat = check(latitudeRule);
const lng = check(longitudeRule);

describe("teamTypeIcon", () => {
  it("resolves a known discipline to its icon", () => {
    expect(teamTypeIcon("Flood Rescue")).toBe(CAPABILITY_ICONS["Flood Rescue"]);
    expect(teamTypeIcon("Flood Rescue")).toBeTruthy();
  });

  it("falls back to a generic shield for an unlisted discipline", () => {
    expect(teamTypeIcon("Something Novel")).toBeTruthy();
    expect(teamTypeIcon("Something Novel")).not.toBe(teamTypeIcon("Flood Rescue"));
  });
});

describe("option lists", () => {
  it("keep every discipline, capability and equipment entry non-empty and unique", () => {
    for (const list of [TEAM_TYPES, TEAM_CAPABILITIES, TEAM_EQUIPMENT]) {
      expect(list.every((item) => item.length > 0)).toBe(true);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it("provide an icon for every capability and equipment choice", () => {
    expect(TEAM_CAPABILITIES.every((c) => CAPABILITY_ICONS[c])).toBe(true);
    expect(TEAM_EQUIPMENT.every((e) => EQUIPMENT_ICONS[e])).toBe(true);
  });
});

describe("nicRule", () => {
  it("demands a value", () => {
    expect(nic("")).toBe("NIC / official ID is required.");
    expect(nic("   ")).toBe("NIC / official ID is required.");
    expect(nic(null as unknown as string)).toBe("NIC / official ID is required.");
  });

  it("accepts the two legitimate Sri Lankan formats", () => {
    expect(nic("123456789V")).toBeNull();
    expect(nic("123456789x")).toBeNull();
    expect(nic("123456789012")).toBeNull();
  });

  it("rejects a malformed identifier", () => {
    expect(nic("12345")).toBe("NIC must be 9 digits followed by V or X, or 12 digits.");
    expect(nic("12345678A9")).toBe("NIC must be 9 digits followed by V or X, or 12 digits.");
  });
});

describe("oneOfRule", () => {
  const rule = check(oneOfRule("Team type", TEAM_TYPES));

  it("requires a selection", () => {
    expect(rule("")).toBe("Team type is required.");
  });

  it("rejects a value outside the allowed set", () => {
    expect(rule("Sky Rescue")).toBe("Team type is not a supported option.");
  });

  it("accepts a listed option, ignoring surrounding space", () => {
    expect(rule("Flood Rescue")).toBeNull();
    expect(rule("  Other  ")).toBeNull();
  });
});

describe("toList", () => {
  it("splits, trims and drops empty entries", () => {
    expect(toList("Flood Rescue, Evacuation ,, Water Rescue")).toEqual([
      "Flood Rescue",
      "Evacuation",
      "Water Rescue",
    ]);
  });

  it("returns nothing for an empty or absent value", () => {
    expect(toList("")).toEqual([]);
    expect(toList("  ,  , ")).toEqual([]);
    expect(toList(null as unknown as string)).toEqual([]);
  });
});

describe("listRule", () => {
  const rule = check(listRule("Capabilities", TEAM_CAPABILITIES, 1));

  it("enforces the minimum number of selections", () => {
    expect(rule("")).toBe("Select at least one capabilities.");
    const twoMin = check(listRule("Equipment", TEAM_EQUIPMENT, 2));
    expect(twoMin("Rescue Boat")).toBe("Equipment needs at least 2 selections.");
  });

  it("names an unsupported choice", () => {
    expect(rule("Flood Rescue, Submarine Ops")).toBe("Submarine Ops is not a supported capabilities.");
  });

  it("accepts a valid selection set", () => {
    expect(rule("Flood Rescue, Evacuation")).toBeNull();
  });

  it("allows an empty value when no minimum is set", () => {
    const noMin = check(listRule("Capabilities", TEAM_CAPABILITIES));
    expect(noMin("")).toBeNull();
  });
});

describe("optionalListRule", () => {
  const rule = check(optionalListRule("Equipment", TEAM_EQUIPMENT));

  it("stays silent about an empty selection", () => {
    expect(rule("")).toBeNull();
  });

  it("still rejects an unknown item when something is chosen", () => {
    expect(rule("Submarine")).toBe("Submarine is not a supported equipment.");
  });

  it("accepts valid entries", () => {
    expect(rule("Rescue Boat, Drone")).toBeNull();
  });
});

describe("latitudeRule", () => {
  it("requires a value and points to the map", () => {
    expect(lat("")).toBe("Base latitude is required. Pick the base location on the map.");
  });

  it("rejects a non-numeric entry", () => {
    expect(lat("abc")).toBe("Base latitude must be a number.");
  });

  it("rejects a coordinate outside Sri Lanka's latitude band", () => {
    expect(lat("5.0")).toBe("Base latitude must be inside Sri Lanka.");
    expect(lat("11.0")).toBe("Base latitude must be inside Sri Lanka.");
  });

  it("accepts a coordinate within the band", () => {
    expect(lat("6.9271")).toBeNull();
  });
});

describe("longitudeRule", () => {
  it("rejects a coordinate outside Sri Lanka's longitude band", () => {
    expect(lng("79.0")).toBe("Base longitude must be inside Sri Lanka.");
    expect(lng("82.5")).toBe("Base longitude must be inside Sri Lanka.");
  });

  it("accepts a coordinate within the band", () => {
    expect(lng("79.8612")).toBeNull();
  });
});
