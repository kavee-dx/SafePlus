import {
  validateDispatch,
  validateStatus,
  validateReason,
  validateAcceptance,
  validateClosure,
} from "../validators/kaveesha-dispatchValidators";
import { ApiError } from "../utils/apiError";

const UUID = "11111111-1111-4111-8111-111111111111";

function capture(action: () => unknown): ApiError {
  try {
    action();
  } catch (error) {
    return error as ApiError;
  }

  throw new Error("expected the validator to throw");
}

describe("validateDispatch", () => {
  it("accepts a bare team id and leaves the optional fields undefined", () => {
    expect(validateDispatch({ teamId: UUID })).toEqual({
      teamId: UUID,
      missionNotes: undefined,
      recommendationScore: undefined,
      recommendationFactors: undefined,
    });
  });

  it("trims the team id", () => {
    expect(validateDispatch({ teamId: `  ${UUID}  ` }).teamId).toBe(UUID);
  });

  it("rejects a body that is not a plain object", () => {
    const error = capture(() => validateDispatch([1, 2, 3]));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe("Send a JSON object.");
  });

  it("requires a team id", () => {
    const error = capture(() => validateDispatch({}));
    expect(error.status).toBe(400);
    expect(error.fieldErrors).toEqual({ teamId: "Choose the rescue team to task." });
  });

  it("rejects a team id that is not a uuid", () => {
    const error = capture(() => validateDispatch({ teamId: "not-a-uuid" }));
    expect(error.fieldErrors?.teamId).toBe("That team reference is not valid.");
  });

  it("keeps a mission brief within the limit and trims it", () => {
    expect(validateDispatch({ teamId: UUID, missionNotes: "  deploy now  " }).missionNotes).toBe(
      "deploy now"
    );
  });

  it("drops a whitespace-only mission brief without an error", () => {
    expect(validateDispatch({ teamId: UUID, missionNotes: "   " }).missionNotes).toBeUndefined();
  });

  it("rejects a mission brief that is not text", () => {
    const error = capture(() => validateDispatch({ teamId: UUID, missionNotes: 42 }));
    expect(error.fieldErrors?.missionNotes).toBe("Mission brief must be text.");
  });

  it("rejects a mission brief over 500 characters", () => {
    const error = capture(() => validateDispatch({ teamId: UUID, missionNotes: "a".repeat(501) }));
    expect(error.fieldErrors?.missionNotes).toBe("Mission brief must be 500 characters or fewer.");
  });

  it("rounds a recommendation score to one decimal", () => {
    expect(validateDispatch({ teamId: UUID, recommendationScore: 87.34 }).recommendationScore).toBe(
      87.3
    );
  });

  it("rejects a recommendation score outside 0 to 100", () => {
    const error = capture(() => validateDispatch({ teamId: UUID, recommendationScore: 150 }));
    expect(error.fieldErrors?.recommendationScore).toBe(
      "The recommendation score is between 0 and 100."
    );
  });

  it("keeps recommendation factors that are an object", () => {
    expect(
      validateDispatch({ teamId: UUID, recommendationFactors: { reach: 10 } }).recommendationFactors
    ).toEqual({ reach: 10 });
  });

  it("rejects recommendation factors that are an array", () => {
    const error = capture(() => validateDispatch({ teamId: UUID, recommendationFactors: [1, 2] }));
    expect(error.fieldErrors?.recommendationFactors).toBe(
      "The recommendation factors must be an object."
    );
  });
});

describe("validateStatus", () => {
  it("uppercases a valid stage and reads the optional outcome numbers", () => {
    expect(
      validateStatus({ status: " en_route ", peopleRescued: 8, peopleEvacuated: 3 })
    ).toEqual({ status: "EN_ROUTE", note: undefined, peopleRescued: 8, peopleEvacuated: 3 });
  });

  it("rejects an unknown stage", () => {
    const error = capture(() => validateStatus({ status: "TELEPORTED" }));
    expect(error.status).toBe(400);
    expect(error.fieldErrors?.status).toContain("Choose a stage from:");
  });

  it("rejects a missing stage", () => {
    expect(capture(() => validateStatus({})).fieldErrors?.status).toBeDefined();
  });

  it("rejects a fractional people count", () => {
    const error = capture(() => validateStatus({ status: "ARRIVED", peopleRescued: 1.5 }));
    expect(error.fieldErrors?.peopleRescued).toBe("People rescued must be a whole number of people.");
  });

  it("rejects a negative people count", () => {
    const error = capture(() => validateStatus({ status: "ARRIVED", peopleEvacuated: -2 }));
    expect(error.fieldErrors?.peopleEvacuated).toBe(
      "People evacuated must be a whole number of people."
    );
  });

  it("rejects a people count above the ceiling", () => {
    const error = capture(() => validateStatus({ status: "ARRIVED", peopleRescued: 1_000_001 }));
    expect(error.fieldErrors?.peopleRescued).toBeDefined();
  });

  it("accepts zero as a valid whole number", () => {
    expect(validateStatus({ status: "ARRIVED", peopleRescued: 0 }).peopleRescued).toBe(0);
  });

  it("rejects a note longer than 300 characters", () => {
    const error = capture(() => validateStatus({ status: "ARRIVED", note: "a".repeat(301) }));
    expect(error.fieldErrors?.note).toBe("Note must be 300 characters or fewer.");
  });

  it("rejects a non-object body", () => {
    expect(capture(() => validateStatus("nope")).message).toBe("Send a JSON object.");
  });
});

describe("validateReason", () => {
  it("trims a supplied reason", () => {
    expect(validateReason({ reason: "  unsafe  " })).toEqual({ reason: "unsafe" });
  });

  it("returns an empty object when no reason is given", () => {
    expect(validateReason({})).toEqual({});
    expect(validateReason({ reason: "   " })).toEqual({});
  });

  it("rejects a reason that is too long", () => {
    const error = capture(() => validateReason({ reason: "a".repeat(501) }));
    expect(error.fieldErrors?.reason).toBe("Reason must be 500 characters or fewer.");
  });
});

describe("validateAcceptance", () => {
  it("treats a missing body as an empty handover", () => {
    expect(validateAcceptance(undefined)).toEqual({});
    expect(validateAcceptance(null)).toEqual({});
  });

  it("keeps a supplied handover note", () => {
    expect(validateAcceptance({ note: " handed to the field unit " })).toEqual({
      note: "handed to the field unit",
    });
  });

  it("rejects a handover note over 300 characters", () => {
    const error = capture(() => validateAcceptance({ note: "a".repeat(301) }));
    expect(error.fieldErrors?.note).toBe("Handover note must be 300 characters or fewer.");
  });
});

describe("validateClosure", () => {
  it("treats a missing body as an empty closure", () => {
    expect(validateClosure(undefined)).toEqual({});
  });

  it("keeps a closing note verbatim once trimmed", () => {
    expect(validateClosure({ note: " all clear " })).toEqual({ note: "all clear" });
  });

  it("rejects a closing note over 400 characters", () => {
    const error = capture(() => validateClosure({ note: "a".repeat(401) }));
    expect(error.fieldErrors?.note).toBe("Closing note must be 400 characters or fewer.");
  });
});
