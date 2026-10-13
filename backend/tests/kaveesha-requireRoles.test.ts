import { requireTeamLeader } from "../middlewares/kaveesha-requireTeamLeader";
import { requireDistrictBoard } from "../middlewares/kaveesha-requireDistrictBoard";
import { requireRescueOrganizationAdmin } from "../middlewares/kaveesha-requireRescueOrganization";
import { requireShelterManager } from "../middlewares/kaveesha-requireShelterManager";
import { ApiError } from "../utils/apiError";

type Guard = (req: never, res: never, next: () => void) => void;

function run(guard: Guard, role?: string) {
  const req = { user: role ? { role } : undefined } as never;
  const res = {} as never;
  const next = jest.fn();

  guard(req, res, next);

  return next;
}

function thrown(guard: Guard, role?: string): ApiError {
  try {
    run(guard, role);
  } catch (error) {
    return error as ApiError;
  }

  throw new Error("expected the guard to throw");
}

describe("requireTeamLeader", () => {
  it.each(["ORGANIZATION_TEAM_LEADER", "INDEPENDENT_TEAM_LEADER"])(
    "admits %s",
    (role) => {
      expect(run(requireTeamLeader as Guard, role)).toHaveBeenCalledTimes(1);
    }
  );

  it("rejects a stranger role with 403", () => {
    const error = thrown(requireTeamLeader as Guard, "SUPER_ADMIN");
    expect(error.status).toBe(403);
    expect(error.message).toContain("team leaders");
  });

  it("demands authentication first", () => {
    expect(thrown(requireTeamLeader as Guard).status).toBe(401);
  });
});

describe("requireDistrictBoard", () => {
  it.each(["DISTRICT_OFFICER", "DMC_OFFICER"])("admits %s", (role) => {
    expect(run(requireDistrictBoard as Guard, role)).toHaveBeenCalledTimes(1);
  });

  it("rejects a citizen with 403", () => {
    expect(thrown(requireDistrictBoard as Guard, "CITIZEN").status).toBe(403);
  });

  it("demands authentication first", () => {
    expect(thrown(requireDistrictBoard as Guard).status).toBe(401);
  });
});

describe("requireRescueOrganizationAdmin", () => {
  it("admits the organization admin", () => {
    expect(
      run(requireRescueOrganizationAdmin as Guard, "RESCUE_ORGANIZATION_ADMIN")
    ).toHaveBeenCalledTimes(1);
  });

  it("rejects a district officer with 403", () => {
    expect(thrown(requireRescueOrganizationAdmin as Guard, "DISTRICT_OFFICER").status).toBe(403);
  });

  it("demands authentication first", () => {
    expect(thrown(requireRescueOrganizationAdmin as Guard).status).toBe(401);
  });
});

describe("requireShelterManager", () => {
  it("admits the shelter manager", () => {
    expect(run(requireShelterManager as Guard, "SHELTER_MANAGER")).toHaveBeenCalledTimes(1);
  });

  it("rejects a team leader with 403", () => {
    expect(thrown(requireShelterManager as Guard, "INDEPENDENT_TEAM_LEADER").status).toBe(403);
  });

  it("demands authentication first", () => {
    expect(thrown(requireShelterManager as Guard).status).toBe(401);
  });
});
