import { ApiError } from "../utils/apiError";
import { HAZARD_TYPES, SEVERITY_LEVELS } from "../models/hazardReport";
import type {
  DetailedReportInput,
  EvidenceInput,
  EvidenceKind,
  RequestInfoInput,
} from "../models/amasha-hazardReportExt";

type Field = Record<string, string>;

const MAX_EVIDENCE = 4;
// ~8 MB of base64 per file; the whole JSON body is capped in app.ts.
const MAX_DATA_URL_LENGTH = 11_000_000;

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

function booleanFlag(source: Record<string, unknown>, field: string): boolean {
  const raw = source[field];

  return raw === true || raw === "true" || raw === 1 || raw === "1";
}

/**
 * Date & time observed is mandatory in UC-02. It must parse and cannot be in
 * the future beyond a small clock-skew allowance.
 */
function observedAt(
  source: Record<string, unknown>,
  errors: Field
): string {
  const raw = source.observedAt;

  if (raw === undefined || raw === null || String(raw).trim() === "") {
    errors.observedAt = "Date and time observed is required.";

    return "";
  }

  const value = String(raw).trim();
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    errors.observedAt = "Enter a valid date and time.";

    return "";
  }

  if (parsed.getTime() > Date.now() + 5 * 60 * 1000) {
    errors.observedAt = "The observed time cannot be in the future.";

    return "";
  }

  return parsed.toISOString();
}

function evidence(source: Record<string, unknown>, errors: Field): EvidenceInput[] {
  const raw = source.attachments;

  if (raw === undefined || raw === null || raw === "") {
    return [];
  }

  if (!Array.isArray(raw)) {
    errors.attachments = "Evidence must be a list of files.";

    return [];
  }

  if (raw.length > MAX_EVIDENCE) {
    errors.attachments = `Attach at most ${MAX_EVIDENCE} photos or videos.`;

    return [];
  }

  const result: EvidenceInput[] = [];

  for (let index = 0; index < raw.length; index += 1) {
    const item = (raw[index] ?? {}) as Record<string, unknown>;
    const dataUrl = typeof item.dataUrl === "string" ? item.dataUrl.trim() : "";

    if (!dataUrl.startsWith("data:")) {
      errors.attachments = `Evidence item ${index + 1} is not a valid file.`;
      break;
    }

    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      errors.attachments = `Evidence item ${index + 1} is too large.`;
      break;
    }

    const kind: EvidenceKind = item.fileKind === "VIDEO" ? "VIDEO" : "PHOTO";

    result.push({
      dataUrl,
      fileKind: kind,
      contentType:
        typeof item.contentType === "string" ? item.contentType : undefined,
    });
  }

  return result;
}

/** Shared body of the first submission and the A2 resubmission. */
function parseDetailed(
  body: unknown,
  { withEvidence }: { withEvidence: boolean }
): DetailedReportInput {
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
  const observed = observedAt(source, errors);
  const landmark = text(source, "landmark", "Landmark", errors, {
    min: 2,
    max: 200,
    required: false,
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

  if (locationLat === undefined || locationLng === undefined) {
    errors.locationLat = "Location is required. Capture GPS or enter coordinates.";
    errors.locationLng = errors.locationLat;
  }

  const attachments = withEvidence ? evidence(source, errors) : [];

  if (Object.keys(errors).length > 0) {
    fail("Fix the highlighted fields before submitting.", errors);
  }

  return {
    hazardType,
    severityLevel,
    locationDistrict,
    description,
    observedAt: observed,
    ...(landmark ? { landmark } : {}),
    ...(locationLat !== undefined ? { locationLat } : {}),
    ...(locationLng !== undefined ? { locationLng } : {}),
    ...(affectedPopulation !== undefined ? { affectedPopulation } : {}),
    immediateDanger: booleanFlag(source, "immediateDanger"),
    ...(attachments.length > 0 ? { attachments } : {}),
  };
}

export function validateDetailedSubmission(body: unknown): DetailedReportInput {
  return parseDetailed(body, { withEvidence: true });
}

export function validateResubmission(body: unknown): DetailedReportInput {
  return parseDetailed(body, { withEvidence: true });
}

export function validateRequestInfo(body: unknown): RequestInfoInput {
  const source = asObject(body);
  const errors: Field = {};

  const reason = text(source, "reason", "Reason", errors, { min: 10, max: 1000 });

  if (Object.keys(errors).length > 0) {
    fail("Tell the citizen what else you need.", errors);
  }

  return { reason };
}
