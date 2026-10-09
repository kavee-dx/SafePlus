import {
  parseBoundary,
  validateBroadcast,
  validateDraft,
  validateExpiryExtension,
  validatePinSetup,
  validateReportVerification,
  validateStandDown,
} from "../validators/dushani-alertValidators";
import { ApiError } from "../utils/apiError";
import { MAX_EXPIRY_EXTENSION_HOURS } from "../models/disasterWarning";

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

describe("parseBoundary", () => {
  it("treats an absent polygon as no custom area at all", () => {
    expect(parseBoundary(undefined)).toEqual([]);
    expect(parseBoundary(null)).toEqual([]);
    expect(parseBoundary("")).toEqual([]);
  });

  it("keeps the corners in the order the officer drew them", () => {
    const points = [
      { lat: 6.9, lng: 79.86 },
      { lat: 6.95, lng: 79.86 },
      { lat: 6.95, lng: 79.92 },
      { lat: 6.9, lng: 79.92 },
    ];

    expect(parseBoundary(points)).toEqual(points);
  });

  it("rejects a vertex outside Sri Lanka by coordinate", () => {
    expectFields(
      () =>
        parseBoundary([
          { lat: 15, lng: 79.86 },
          { lat: 6.9, lng: 70 },
          { lat: 6.95, lng: 79.92 },
          { lat: 6.92, lng: 79.94 },
        ]),
      /target boundary/i,
      ["customBoundary[0].lat", "customBoundary[1].lng"]
    );
  });

  it("rejects a line that is not a closed shape", () => {
    expectFields(
      () => parseBoundary([{ lat: 6.9, lng: 79.86 }, { lat: 6.95, lng: 79.9 }]),
      /target boundary/i,
      ["customBoundary"]
    );
  });

  it("refuses a non-list", () => {
    expectFields(() => parseBoundary("Colombo"), /target boundary/i, [
      "customBoundary",
    ]);
  });
});

describe("validateDraft", () => {
  const valid = {
    reportId: "RPT-2026-0001",
    hazardType: "FLOOD",
    severityLevel: "CRITICAL",
    targetDistrict: "Kalutara",
    englishMessage: "Severe flooding is expected along the Kalu Ganga basin.",
    sinhalaMessage: "කළු ගඟ දිගේ විශාල ගංවතුරක් අපේක්ෂිතය.",
    tamilMessage: "கழு கங்கா படுகையில் நீர்ப்பெருக்கு எதிர்பார்க்கப்படுகிறது.",
    expiresInHours: 24,
  };

  it("accepts a complete trilingual draft", () => {
    expect(validateDraft(valid).reportId).toBe("RPT-2026-0001");
  });

  it("lists every missing field at once so the officer fixes the form in one pass", () => {
    expectFields(
      () => validateDraft({ hazardType: "TSUNAMI", severityLevel: "HIGH" }),
      /before saving/i,
      [
        "reportId",
        "targetDistrict",
        "englishMessage",
        "sinhalaMessage",
        "tamilMessage",
        "expiresInHours",
      ]
    );
  });

  it("only offers the lifetimes the countdown understands", () => {
    expectFields(
      () => validateDraft({ ...valid, expiresInHours: 5 }),
      /before saving/i,
      ["expiresInHours"]
    );
  });

  it("insists the Sinhala leg is actually written in Sinhala", () => {
    expectFields(
      () => validateDraft({ ...valid, sinhalaMessage: "Polu watura ekak." }),
      /before saving/i,
      ["sinhalaMessage"]
    );
  });

  it("lets an update leave the report reference and lifetime out", () => {
    const { reportId, expiresInHours, ...rest } = valid;

    expect(() => validateDraft(rest, true)).not.toThrow();
  });
});

describe("clearance PIN gates", () => {
  it("accepts a six digit PIN with a broadcast reference", () => {
    expect(validateBroadcast({ warningId: "WARN-2026-0001", securityPin: "482913" })).toEqual(
      { warningId: "WARN-2026-0001", securityPin: "482913" }
    );
  });

  it.each([
    ["too short", "12345"],
    ["too long", "1234567"],
    ["not digits", "abcd12"],
    ["missing", undefined],
  ])("rejects a stand-down PIN that is %s", (_label, pin) => {
    expectFields(
      () => validateStandDown({ securityPin: pin }),
      /authorization could not be completed/i,
      ["securityPin"]
    );
  });

  it("rejects a body that is not an object", () => {
    try {
      validateStandDown(null);
      throw new Error("should not reach here");
    } catch (error) {
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).message).toMatch(/JSON object/i);
    }
  });

  it("rejects a re-entry PIN that is not six digits", () => {
    expectFields(
      () => validatePinSetup({ pin: "123456", currentPin: "99" }),
      /check the pin you entered/i,
      ["currentPin"]
    );
  });

  it("lets a first-time PIN be set without a current one", () => {
    expect(validatePinSetup({ pin: "482913" })).toEqual({ pin: "482913" });
  });
});

describe("validateExpiryExtension", () => {
  it("accepts a whole number of hours inside the ceiling", () => {
    expect(
      validateExpiryExtension({ extendByHours: 6, securityPin: "482913" })
    ).toEqual({ extendByHours: 6, securityPin: "482913" });
  });

  it("rejects an extension of zero hours", () => {
    expectFields(
      () => validateExpiryExtension({ extendByHours: 0, securityPin: "482913" }),
      /highlighted fields/i,
      ["extendByHours"]
    );
  });

  it("rejects an extension past the ceiling", () => {
    expectFields(
      () =>
        validateExpiryExtension({
          extendByHours: MAX_EXPIRY_EXTENSION_HOURS + 1,
          securityPin: "482913",
        }),
      /highlighted fields/i,
      ["extendByHours"]
    );
  });

  it("still demands the PIN for an otherwise valid extension", () => {
    expectFields(
      () => validateExpiryExtension({ extendByHours: 3, securityPin: "99" }),
      /authorization could not be completed/i,
      ["securityPin"]
    );
  });
});

describe("validateReportVerification", () => {
  it("demands notes when the officer rejects a report", () => {
    expectFields(
      () => validateReportVerification({ status: "REJECTED" }),
      /recording the decision/i,
      ["verificationNotes"]
    );
  });

  it("accepts a verified decision with no notes", () => {
    expect(validateReportVerification({ status: "VERIFIED" }).status).toBe(
      "VERIFIED"
    );
  });

  it("refuses any decision outside VERIFIED and REJECTED", () => {
    expectFields(
      () => validateReportVerification({ status: "PENDING_VERIFICATION" }),
      /recording the decision/i,
      ["status"]
    );
  });
});
