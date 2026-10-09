import {
  validateDetailedSubmission,
  validateRequestInfo,
  validateResubmission,
} from "../validators/amasha-reportValidators";
import { ApiError } from "../utils/apiError";

function expectFields(run: () => unknown, message: RegExp, fields: string[]) {
  expect(run).toThrow(ApiError);

  try {
    run();
  } catch (error) {
    const apiError = error as ApiError;

    expect(apiError.status).toBe(400);
    expect(apiError.message).toMatch(message);
    expect(Object.keys(apiError.fieldErrors ?? {}).sort()).toEqual(fields.sort());
  }
}

const validBase = {
  hazardType: "FLOOD",
  severityLevel: "HIGH",
  locationDistrict: "Colombo",
  description: "Knee-deep floodwater is blocking the lane behind the temple.",
  observedAt: "2026-10-01T08:30",
};

describe("validateDetailedSubmission", () => {
  it("accepts a complete ground report and normalises the observed time to ISO", () => {
    const result = validateDetailedSubmission(validBase);

    expect(result.hazardType).toBe("FLOOD");
    expect(result.severityLevel).toBe("HIGH");
    expect(result.locationDistrict).toBe("Colombo");
    expect(result.observedAt).toBe(new Date(validBase.observedAt).toISOString());
    expect(result.immediateDanger).toBe(false);
    expect("landmark" in result).toBe(false);
    expect("attachments" in result).toBe(false);
  });

  it("keeps optional fields that were actually provided", () => {
    const result = validateDetailedSubmission({
      ...validBase,
      landmark: "Near the Kelani bridge",
      locationLat: "6.9319",
      locationLng: "79.8478",
      affectedPopulation: "120",
      immediateDanger: "true",
    });

    expect(result.landmark).toBe("Near the Kelani bridge");
    expect(result.locationLat).toBe(6.9319);
    expect(result.locationLng).toBe(79.8478);
    expect(result.affectedPopulation).toBe(120);
    expect(result.immediateDanger).toBe(true);
  });

  it("lists every missing field at once so the citizen fixes the form in one pass", () => {
    expectFields(
      () => validateDetailedSubmission({}),
      /highlighted fields/i,
      ["hazardType", "severityLevel", "locationDistrict", "description", "observedAt"]
    );
  });

  it("refuses a body that is not a JSON object", () => {
    expectFields(
      () => validateDetailedSubmission("a flood"),
      /JSON object/i,
      []
    );
  });

  it("rejects hazard types and severities outside the supported lists", () => {
    expectFields(
      () =>
        validateDetailedSubmission({
          ...validBase,
          hazardType: "METEOR_STRIKE",
          severityLevel: "EXTREME",
        }),
      /highlighted fields/i,
      ["hazardType", "severityLevel"]
    );
  });

  it("demands a description of at least 15 characters", () => {
    expectFields(
      () => validateDetailedSubmission({ ...validBase, description: "too short" }),
      /highlighted fields/i,
      ["description"]
    );
  });

  it("rejects an unparseable observed time", () => {
    expectFields(
      () => validateDetailedSubmission({ ...validBase, observedAt: "yesterday evening" }),
      /highlighted fields/i,
      ["observedAt"]
    );
  });

  it("rejects an observed time further in the future than the clock-skew allowance", () => {
    const halfAnHourAhead = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    expectFields(
      () => validateDetailedSubmission({ ...validBase, observedAt: halfAnHourAhead }),
      /highlighted fields/i,
      ["observedAt"]
    );
  });

  it("tolerates a small clock skew of a couple of minutes", () => {
    const justNow = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    expect(
      validateDetailedSubmission({ ...validBase, observedAt: justNow }).observedAt
    ).toBe(justNow);
  });

  it("insists coordinates come as a pair, never half of one", () => {
    expectFields(
      () => validateDetailedSubmission({ ...validBase, locationLat: 6.93 }),
      /highlighted fields/i,
      ["locationLat", "locationLng"]
    );
  });

  it("rejects coordinates outside the globe's ranges", () => {
    expectFields(
      () =>
        validateDetailedSubmission({ ...validBase, locationLat: 91, locationLng: 200 }),
      /highlighted fields/i,
      ["locationLat", "locationLng"]
    );
  });

  it("only accepts whole non-negative affected population counts", () => {
    expectFields(
      () =>
        validateDetailedSubmission({
          ...validBase,
          affectedPopulation: -4,
        }),
      /highlighted fields/i,
      ["affectedPopulation"]
    );

    expectFields(
      () =>
        validateDetailedSubmission({
          ...validBase,
          affectedPopulation: 2.5,
        }),
      /highlighted fields/i,
      ["affectedPopulation"]
    );
  });
});

describe("validateDetailedSubmission evidence rules", () => {
  it("passes a valid photo through with its content type", () => {
    const result = validateDetailedSubmission({
      ...validBase,
      attachments: [
        {
          dataUrl: "data:image/jpeg;base64,AAAA",
          fileKind: "PHOTO",
          contentType: "image/jpeg",
        },
      ],
    });

    expect(result.attachments).toEqual([
      {
        dataUrl: "data:image/jpeg;base64,AAAA",
        fileKind: "PHOTO",
        contentType: "image/jpeg",
      },
    ]);
  });

  it("coerces an unknown file kind to PHOTO but keeps a real VIDEO", () => {
    const result = validateDetailedSubmission({
      ...validBase,
      attachments: [
        { dataUrl: "data:image/png;base64,BBBB", fileKind: "GIF" },
        { dataUrl: "data:video/mp4;base64,CCCC", fileKind: "VIDEO" },
      ],
    });

    expect(result.attachments?.map((item) => item.fileKind)).toEqual([
      "PHOTO",
      "VIDEO",
    ]);
  });

  it("caps evidence at four photos or videos", () => {
    const fourPhotos = Array.from({ length: 4 }, (_, index) => ({
      dataUrl: `data:image/jpeg;base64,AAA${index}`,
    }));
    const fivePhotos = [
      ...fourPhotos,
      { dataUrl: "data:image/jpeg;base64,AAA4" },
    ];

    expect(
      validateDetailedSubmission({ ...validBase, attachments: fourPhotos }).attachments
    ).toHaveLength(4);

    expectFields(
      () => validateDetailedSubmission({ ...validBase, attachments: fivePhotos }),
      /highlighted fields/i,
      ["attachments"]
    );
  });

  it("rejects evidence that is not an inline data URL", () => {
    expectFields(
      () =>
        validateDetailedSubmission({
          ...validBase,
          attachments: [{ dataUrl: "https://example.com/flood.jpg" }],
        }),
      /highlighted fields/i,
      ["attachments"]
    );
  });

  it("rejects an attachment whose base64 payload exceeds the size ceiling", () => {
    const oversized = "data:image/jpeg;base64," + "A".repeat(11_000_001);

    expectFields(
      () =>
        validateDetailedSubmission({
          ...validBase,
          attachments: [{ dataUrl: oversized }],
        }),
      /highlighted fields/i,
      ["attachments"]
    );
  });
});

describe("validateResubmission", () => {
  it("applies the same rules as the first submission", () => {
    const result = validateResubmission({
      ...validBase,
      landmark: "Same place as before",
    });

    expect(result.landmark).toBe("Same place as before");
  });

  it("still validates evidence on the way back up", () => {
    expectFields(
      () =>
        validateResubmission({
          ...validBase,
          attachments: [{ dataUrl: "not-a-data-url" }],
        }),
      /highlighted fields/i,
      ["attachments"]
    );
  });
});

describe("validateRequestInfo", () => {
  it("returns the trimmed reason for a clear request", () => {
    expect(
      validateRequestInfo({ reason: "  Please add the nearest landmark.  " })
    ).toEqual({ reason: "Please add the nearest landmark." });
  });

  it("demands a reason of at least 10 characters", () => {
    expectFields(() => validateRequestInfo({ reason: "why?" }), /else you need/i, [
      "reason",
    ]);

    expectFields(() => validateRequestInfo({}), /else you need/i, ["reason"]);
  });

  it("caps the reason at 1000 characters", () => {
    expectFields(
      () => validateRequestInfo({ reason: "x".repeat(1001) }),
      /else you need/i,
      ["reason"]
    );
  });

  it("refuses a body that is not a JSON object", () => {
    expectFields(() => validateRequestInfo(null), /JSON object/i, []);
  });
});
