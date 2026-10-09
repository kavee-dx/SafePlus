import { ApiError } from "../utils/apiError";
import {
  HAZARD_TYPES,
  ReportStatus,
  SEVERITY_LEVELS,
  type CreateReportRequest,
  type VerifyReportRequest,
} from "../models/hazardReport";
import {
  MAX_EXPIRY_EXTENSION_HOURS,
  WARNING_LIFETIME_HOURS,
  type ChannelSelection,
  type Coordinate,
  type CreateDraftRequest,
  type BroadcastWarningRequest,
} from "../models/disasterWarning";

const SINHALA_RANGE = /[\u0d80-\u0dff]/;
const TAMIL_RANGE = /[\u0b80-\u0bff]/;
const PIN_PATTERN = /^\d{6}$/;

type Field = Record<string, string>;

function fail(message: string, errors: Field): never {
  throw new ApiError(400, message, errors);
}

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail("Request body must be a JSON object.", {});
  }

  return body as Record<string, unknown>;
}

function text(
  source: Record<string, unknown>,
  field: string,
  label: string,
  errors: Field,
  { min = 3, max = 4000, required = true } = {}
): string {
  const raw = source[field];

  if (raw === undefined || raw === null || String(raw).trim() === "") {
    if (required) {
      errors[field] = `${label} is required.`;
    }

    return "";
  }

  const value = String(raw).trim();

  if (value.length < min) {
    errors[field] = `${label} must be at least ${min} characters.`;
  } else if (value.length > max) {
    errors[field] = `${label} must be under ${max} characters.`;
  }

  return value;
}

function optionalNumber(
  source: Record<string, unknown>,
  field: string,
  label: string,
  errors: Field,
  bounds: { min: number; max: number }
): number | undefined {
  const raw = source[field];

  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return undefined;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < bounds.min || value > bounds.max) {
    errors[field] = `${label} must be a number between ${bounds.min} and ${bounds.max}.`;

    return undefined;
  }

  return value;
}

function wholeNumber(
  source: Record<string, unknown>,
  field: string,
  label: string,
  errors: Field
): number | undefined {
  const raw = source[field];

  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return undefined;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value < 0) {
    errors[field] = `${label} must be a whole number.`;

    return undefined;
  }

  return value;
}

function selection(
  source: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
  label: string,
  errors: Field
): string {
  const value = text(source, field, label, errors, { min: 2, max: 60 });

  if (value && !allowed.includes(value)) {
    errors[field] = `${label} is not a supported option.`;
  }

  return value;
}

function flags(source: Record<string, unknown>, errors: Field): ChannelSelection {
  const raw = source.channels;
  const channels = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;

  const read = (field: keyof ChannelSelection, fallback: boolean): boolean => {
    const value = channels[field];

    if (value === undefined || value === null || value === "") {
      return fallback;
    }

    if (typeof value !== "boolean") {
      errors[`channels.${field}`] = "Must be true or false.";

      return fallback;
    }

    return value;
  };

  const result: ChannelSelection = {
    push: read("push", true),
    sms: read("sms", true),
    siren: read("siren", false),
  };

  if (!result.push && !result.sms && !result.siren) {
    errors.channels = "Choose at least one channel to reach people.";
  }

  return result;
}

/**
 * A drawn or pasted target polygon. Points are kept in order and the closing
 * vertex is dropped because the boundary service re-closes it.
 */
export function parseBoundary(value: unknown, field = "customBoundary"): Coordinate[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (!Array.isArray(value)) {
    fail("Target boundary is not valid.", { [field]: "Must be a list of points." });
  }

  const errors: Field = {};
  const points = value.map((item, index) => {
    const point = (item ?? {}) as Record<string, unknown>;
    const lat = Number(point.lat);
    const lng = Number(point.lng);

    if (!Number.isFinite(lat) || lat < 5 || lat > 10.2) {
      errors[`${field}[${index}].lat`] = "Latitude must be inside Sri Lanka (5 to 10.2).";
    }

    if (!Number.isFinite(lng) || lng < 79.6 || lng > 82.2) {
      errors[`${field}[${index}].lng`] = "Longitude must be inside Sri Lanka (79.6 to 82.2).";
    }

    return { lat, lng };
  });

  if (points.length > 0 && points.length < 4) {
    errors[field] = "Draw at least 3 corners.";
  }

  if (points.length > 200) {
    errors[field] = "A boundary may have at most 200 corners.";
  }

  if (Object.keys(errors).length > 0) {
    fail("Check the drawn target boundary.", errors);
  }

  return points;
}

export function validateReportSubmission(body: unknown): CreateReportRequest {
  const source = asObject(body);
  const errors: Field = {};

  const hazardType = selection(source, HAZARD_TYPES, "hazardType", "Hazard type", errors);
  const severityLevel = selection(
    source,
    SEVERITY_LEVELS,
    "severityLevel",
    "Severity level",
    errors
  );
  const locationDistrict = text(source, "locationDistrict", "District", errors, {
    min: 2,
    max: 80,
  });
  const description = text(source, "description", "Description", errors, {
    min: 15,
    max: 2000,
  });
  const locationLat = optionalNumber(source, "locationLat", "Latitude", errors, {
    min: -90,
    max: 90,
  });
  const locationLng = optionalNumber(source, "locationLng", "Longitude", errors, {
    min: -180,
    max: 180,
  });
  const affectedPopulation = wholeNumber(
    source,
    "affectedPopulation",
    "Affected population",
    errors
  );

  if ((locationLat === undefined) !== (locationLng === undefined)) {
    errors.locationLat = "Report both a latitude and a longitude, or neither.";
    errors.locationLng = errors.locationLat;
  }

  if (Object.keys(errors).length > 0) {
    fail("Fix the highlighted fields before submitting.", errors);
  }

  return {
    hazardType,
    severityLevel,
    locationDistrict,
    description,
    ...(locationLat !== undefined ? { locationLat } : {}),
    ...(locationLng !== undefined ? { locationLng } : {}),
    ...(affectedPopulation !== undefined ? { affectedPopulation } : {}),
  };
}

export function validateReportVerification(body: unknown): VerifyReportRequest {
  const source = asObject(body);
  const errors: Field = {};
  const status = text(source, "status", "Decision", errors, { min: 4, max: 30 });

  if (status && ![ReportStatus.VERIFIED, ReportStatus.REJECTED].includes(status as ReportStatus)) {
    errors.status = "A report can only be marked VERIFIED or REJECTED.";
  }

  const verificationNotes = text(source, "verificationNotes", "Notes", errors, {
    min: 10,
    max: 1000,
    required: status === ReportStatus.REJECTED,
  });

  if (Object.keys(errors).length > 0) {
    fail("Fix the highlighted fields before recording the decision.", errors);
  }

  return {
    status: status as ReportStatus.VERIFIED | ReportStatus.REJECTED,
    ...(verificationNotes ? { verificationNotes } : {}),
  };
}

/**
 * Draft payload. The report link is mandatory: a warning can only ever be
 * raised on top of a verified ground report.
 */
export function validateDraft(body: unknown, isUpdate = false): CreateDraftRequest {
  const source = asObject(body);
  const errors: Field = {};
  const optional = isUpdate;

  const reportId = text(source, "reportId", "Verified report", errors, {
    min: 5,
    max: 60,
    required: !optional,
  });
  const hazardType = selection(source, HAZARD_TYPES, "hazardType", "Hazard type", errors);
  const severityLevel = selection(
    source,
    SEVERITY_LEVELS,
    "severityLevel",
    "Severity level",
    errors
  );
  const targetDistrict = text(source, "targetDistrict", "Target district", errors, {
    min: 2,
    max: 80,
    required: !optional,
  });
  const englishMessage = text(source, "englishMessage", "English message", errors, {
    min: 20,
    max: 480,
    required: !optional,
  });
  const sinhalaMessage = text(source, "sinhalaMessage", "Sinhala message", errors, {
    min: 15,
    max: 480,
    required: !optional,
  });
  const tamilMessage = text(source, "tamilMessage", "Tamil message", errors, {
    min: 15,
    max: 480,
    required: !optional,
  });
  const safetyInstructions = text(
    source,
    "safetyInstructions",
    "Safety instructions",
    errors,
    { min: 10, max: 600, required: false }
  );

  if (sinhalaMessage && !SINHALA_RANGE.test(sinhalaMessage)) {
    errors.sinhalaMessage = "Write the Sinhala message in Sinhala script.";
  }

  if (tamilMessage && !TAMIL_RANGE.test(tamilMessage)) {
    errors.tamilMessage = "Write the Tamil message in Tamil script.";
  }

  const channels = flags(source, errors);
  const customBoundary = parseBoundary(source.customBoundary);
  const expiresInHours = wholeNumber(
    source,
    "expiresInHours",
    "Alert lifetime",
    errors
  );

  if (expiresInHours === undefined && !optional) {
    errors.expiresInHours = "Choose how long the warning stays active.";
  } else if (
    expiresInHours !== undefined &&
    !(WARNING_LIFETIME_HOURS as readonly number[]).includes(expiresInHours)
  ) {
    errors.expiresInHours = "Choose one of the supported lifetimes.";
  }

  if (Object.keys(errors).length > 0) {
    fail("Fix the highlighted fields before saving.", errors);
  }

  return {
    reportId,
    hazardType,
    severityLevel,
    targetDistrict,
    englishMessage,
    sinhalaMessage,
    tamilMessage,
    channels,
    ...(safetyInstructions ? { safetyInstructions } : {}),
    ...(customBoundary.length > 0 ? { customBoundary } : {}),
    ...(expiresInHours !== undefined ? { expiresInHours } : {}),
  };
}

/** Body of the extend-expiry call: how many more hours the warning should hold. */
export function validateExpiryExtension(body: unknown): { extendByHours: number; securityPin: string } {
  const source = asObject(body);
  const errors: Field = {};

  const extendByHours = wholeNumber(source, "extendByHours", "Extension", errors);
  const securityPin = text(source, "securityPin", "Clearance PIN", errors, {
    min: 6,
    max: 6,
  });

  if (extendByHours === undefined) {
    fail("Fix the highlighted fields before extending the warning.", {
      extendByHours: "Say how many more hours the warning should stay active.",
    });
  }

  if (extendByHours < 1) {
    fail("Fix the highlighted fields before extending the warning.", {
      extendByHours: "An extension must be at least one hour.",
    });
  }

  if (extendByHours > MAX_EXPIRY_EXTENSION_HOURS) {
    fail("Fix the highlighted fields before extending the warning.", {
      extendByHours: `An extension is at most ${MAX_EXPIRY_EXTENSION_HOURS} hours.`,
    });
  }

  if (securityPin && !PIN_PATTERN.test(securityPin)) {
    errors.securityPin = "Clearance PIN must be exactly 6 digits.";
  }

  if (Object.keys(errors).length > 0) {
    fail("Authorization could not be completed.", errors);
  }

  return { extendByHours, securityPin };
}

/**
 * Standing a warning down pulls a live alert off every handset in the area, so
 * it clears the same PIN as the broadcast that put it there.
 */
export function validateStandDown(body: unknown): { securityPin: string } {
  const source = asObject(body);
  const errors: Field = {};

  const securityPin = text(source, "securityPin", "Clearance PIN", errors, {
    min: 6,
    max: 6,
  });

  if (securityPin && !PIN_PATTERN.test(securityPin)) {
    errors.securityPin = "Clearance PIN must be exactly 6 digits.";
  }

  if (Object.keys(errors).length > 0) {
    fail("Authorization could not be completed.", errors);
  }

  return { securityPin };
}

export function validateBroadcast(body: unknown): BroadcastWarningRequest {
  const source = asObject(body);
  const errors: Field = {};
  const warningId = text(source, "warningId", "Warning", errors, { min: 5, max: 60 });
  const securityPin = text(source, "securityPin", "Clearance PIN", errors, {
    min: 6,
    max: 6,
  });

  if (securityPin && !PIN_PATTERN.test(securityPin)) {
    errors.securityPin = "Clearance PIN must be exactly 6 digits.";
  }

  if (Object.keys(errors).length > 0) {
    fail("Authorization could not be completed.", errors);
  }

  return { warningId, securityPin };
}

export function validatePinSetup(body: unknown): {
  pin: string;
  currentPin?: string;
} {
  const source = asObject(body);
  const errors: Field = {};
  const pin = text(source, "pin", "New PIN", errors, { min: 6, max: 6 });
  const currentPin = text(source, "currentPin", "Current PIN", errors, {
    min: 6,
    max: 6,
    required: false,
  });

  if (pin && !PIN_PATTERN.test(pin)) {
    errors.pin = "Use exactly 6 digits.";
  }

  if (currentPin && !PIN_PATTERN.test(currentPin)) {
    errors.currentPin = "Use exactly 6 digits.";
  }

  if (Object.keys(errors).length > 0) {
    fail("Check the PIN you entered.", errors);
  }

  return { pin, ...(currentPin ? { currentPin } : {}) };
}
