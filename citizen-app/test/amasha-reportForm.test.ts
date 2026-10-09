import {
  emptyDraft,
  draftFromPayload,
  labelFor,
  localDateParts,
  toObservedIso,
  toPayload,
  validateStep,
  valueFor,
  HAZARDS,
  SEVERITIES,
  type ReportDraft,
} from "../src/utils/amasha-reportForm";

function makeDraft(overrides: Partial<ReportDraft> = {}): ReportDraft {
  return {
    ...emptyDraft("Colombo"),
    hazardLabel: "Flood",
    severityLabel: "High",
    description: "Water is knee-deep and rising near the temple lane.",
    observedDate: "2026-10-01",
    observedTime: "08:30",
    ...overrides,
  };
}

describe("hazard and severity label tables", () => {
  it("maps between the codes the API wants and the words citizens read", () => {
    expect(labelFor(HAZARDS, "HEAVY_RAIN")).toBe("Heavy rain");
    expect(labelFor(HAZARDS, "NOT_REAL")).toBe("NOT_REAL");

    expect(valueFor(HAZARDS, "Heavy rain")).toBe("HEAVY_RAIN");
    expect(valueFor(HAZARDS, "Meteor strike")).toBe("");

    expect(labelFor(SEVERITIES, "CRITICAL")).toBe("Critical");
    expect(valueFor(SEVERITIES, "Critical")).toBe("CRITICAL");
  });
});

describe("toObservedIso", () => {
  it("converts the wizard's date and time pickers into an ISO instant", () => {
    const iso = toObservedIso("2026-10-01", "08:30");

    expect(iso).toBe(new Date(2026, 9, 1, 8, 30, 0).toISOString());
  });

  it.each([
    ["malformed date", "01/10/2026", "08:30"],
    ["malformed time", "2026-10-01", "8:30 am"],
    ["empty inputs", "", ""],
  ])("returns null for %s", (_label, date, time) => {
    expect(toObservedIso(date, time)).toBeNull();
  });
});

describe("localDateParts and emptyDraft", () => {
  it("pads the local date and time parts to fixed widths", () => {
    const parts = localDateParts(new Date(2026, 0, 5, 7, 8));

    expect(parts).toEqual({ date: "2026-01-05", time: "07:08" });
  });

  it("starts a draft with now as the observed time and the home district", () => {
    const draft = emptyDraft("Galle");
    const now = localDateParts();

    expect(draft.district).toBe("Galle");
    expect(draft.observedDate).toBe(now.date);
    expect(draft.observedTime).toBe(now.time);
    expect(draft.hazardLabel).toBe("");
    expect(draft.attachments).toEqual([]);
  });
});

describe("draftFromPayload", () => {
  it("turns a stored report back into wizard fields for the resubmission flow", () => {
    const draft = draftFromPayload({
      hazardType: "LANDSLIDE",
      severityLevel: "CRITICAL",
      locationDistrict: "Kegalle",
      description: "Cracks widening on the slope behind the school.",
      landmark: "Behind the school",
      affectedPopulation: 40,
      immediateDanger: true,
      observedAt: "2026-09-30T03:45:00.000Z",
      locationLat: 7.25,
      locationLng: 80.27,
    });

    expect(draft.hazardLabel).toBe("Landslide");
    expect(draft.severityLabel).toBe("Critical");
    expect(draft.district).toBe("Kegalle");
    expect(draft.landmark).toBe("Behind the school");
    expect(draft.population).toBe("40");
    expect(draft.immediateDanger).toBe(true);
    expect(draft.latitude).toBe(7.25);
    expect(draft.longitude).toBe(80.27);
    expect(draft.observedDate).toBe(localDateParts(new Date("2026-09-30T03:45:00.000Z")).date);
  });

  it("falls back to now when a stored report has no readable observed time", () => {
    const draft = draftFromPayload({
      hazardType: "FLOOD",
      severityLevel: "LOW",
      locationDistrict: "Colombo",
      description: "Puddles on the road after the rain.",
      immediateDanger: false,
      observedAt: "not-a-date",
    });

    expect(draft.observedDate).toBe(localDateParts().date);
    expect(draft.population).toBe("");
  });
});

describe("validateStep", () => {
  it("step 0 demands both an incident type and a severity", () => {
    expect(validateStep(0, emptyDraft())).toEqual({
      hazardType: "Choose the kind of incident you are seeing.",
      severityLevel: "Choose how urgent this is.",
    });

    expect(validateStep(0, makeDraft())).toEqual({});
  });

  it("step 1 rejects a description too short to act on", () => {
    expect(validateStep(1, makeDraft({ description: "flooding" }))).toEqual({
      description: "Give at least 15 characters so officers can act.",
    });
  });

  it("step 1 rejects an observed time in the future", () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (value: number) => String(value).padStart(2, "0");
    const draft = makeDraft({
      observedDate: `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}`,
      observedTime: `${pad(soon.getHours())}:${pad(soon.getMinutes())}`,
    });

    expect(validateStep(1, draft).observedAt).toBe(
      "The observed time cannot be in the future."
    );
  });

  it("step 1 only accepts whole numbers for the affected population", () => {
    expect(
      validateStep(1, makeDraft({ population: "about 40" })).affectedPopulation
    ).toBe("Use a whole number, such as 250.");

    expect(validateStep(1, makeDraft({ population: "40" }))).toEqual({});
  });

  it("step 3 demands a district and a complete coordinate pair", () => {
    expect(validateStep(3, makeDraft({ district: "  " }))).toEqual({
      locationDistrict: "Choose the district this is happening in.",
    });

    expect(
      validateStep(3, makeDraft({ latitude: 6.93 }))
    ).toEqual({
      locationLat: "Enter both latitude and longitude, or leave both blank.",
      locationLng: "Enter both latitude and longitude, or leave both blank.",
    });

    expect(
      validateStep(3, makeDraft({ latitude: 6.93, longitude: 79.86 }))
    ).toEqual({});
  });

  it("leaves the evidence step to the picker, not the validator", () => {
    expect(validateStep(2, emptyDraft())).toEqual({});
  });
});

describe("toPayload", () => {
  it("builds the API payload from a complete draft, trimming what the citizen typed", () => {
    const draft = makeDraft({
      description: "  Water is knee-deep and rising near the temple lane.  ",
      landmark: "  Near the temple  ",
      population: " 40 ",
      latitude: 6.93,
      longitude: 79.86,
      immediateDanger: true,
      attachments: [
        { dataUrl: "data:image/jpeg;base64,AAAA", fileKind: "PHOTO" },
      ],
    });

    const result = toPayload(draft);

    if ("errors" in result) {
      throw new Error("expected a payload, got field errors");
    }

    expect(result.payload).toEqual({
      hazardType: "FLOOD",
      severityLevel: "HIGH",
      locationDistrict: "Colombo",
      description: "Water is knee-deep and rising near the temple lane.",
      observedAt: toObservedIso("2026-10-01", "08:30"),
      locationLat: 6.93,
      locationLng: 79.86,
      landmark: "Near the temple",
      affectedPopulation: 40,
      immediateDanger: true,
      attachments: [
        { dataUrl: "data:image/jpeg;base64,AAAA", fileKind: "PHOTO" },
      ],
    });
  });

  it("leaves optional fields out when the citizen left them blank", () => {
    const result = toPayload(makeDraft());

    if ("errors" in result) {
      throw new Error("expected a payload, got field errors");
    }

    expect("landmark" in result.payload).toBe(false);
    expect("affectedPopulation" in result.payload).toBe(false);
    expect("attachments" in result.payload).toBe(false);
    expect(result.payload.locationLat).toBeUndefined();
  });

  it("returns every problem at once instead of the payload", () => {
    const result = toPayload(emptyDraft());
    const errors = "errors" in result ? result.errors : {};

    expect(Object.keys(errors).sort()).toEqual([
      "description",
      "hazardType",
      "locationDistrict",
      "severityLevel",
    ]);
  });
});
