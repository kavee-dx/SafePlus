import { type DispatchStatus, DISPATCH_STATUSES } from "../models/kaveesha-rescueDispatch";
import { ApiError } from "../utils/apiError";

/* ------------------------------------------------------------------ *
 * Dispatch request bodies.
 *
 * Which team, which stage and how many people are the only three things a
 * caller may decide. Identity and district always come from the token.
 * ------------------------------------------------------------------ */

type Field = Record<string, string>;

const MAX_NOTES = 500;
const MAX_NOTE = 300;
const MAX_PEOPLE = 1_000_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "Send a JSON object.");
  }

  return value as Record<string, unknown>;
}

function fail(message: string, errors: Field): never {
  throw new ApiError(400, message, errors);
}

function optionalText(
  source: Record<string, unknown>,
  key: string,
  label: string,
  errors: Field,
  max: number
): string | undefined {
  const raw = source[key];

  if (raw === undefined || raw === null) return undefined;

  if (typeof raw !== "string") {
    errors[key] = `${label} must be text.`;

    return undefined;
  }

  const cleaned = raw.trim();

  if (cleaned === "") return undefined;

  if (cleaned.length > max) {
    errors[key] = `${label} must be ${max} characters or fewer.`;

    return undefined;
  }

  return cleaned;
}

function requiredTeamId(
  source: Record<string, unknown>,
  errors: Field
): string {
  const raw = typeof source.teamId === "string" ? source.teamId.trim() : "";

  if (raw === "") {
    errors.teamId = "Choose the rescue team to task.";
  } else if (!UUID.test(raw)) {
    errors.teamId = "That team reference is not valid.";
  }

  return raw;
}

function optionalScore(
  source: Record<string, unknown>,
  errors: Field
): number | undefined {
  const raw = source.recommendationScore;

  if (raw === undefined || raw === null || raw === "") return undefined;

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    errors.recommendationScore = "The recommendation score is between 0 and 100.";

    return undefined;
  }

  return Math.round(parsed * 10) / 10;
}

/** Stored for the audit trail exactly as the engine produced it. */
function optionalFactors(
  source: Record<string, unknown>,
  errors: Field
): Record<string, unknown> | undefined {
  const raw = source.recommendationFactors;

  if (raw === undefined || raw === null) return undefined;

  if (typeof raw !== "object" || Array.isArray(raw)) {
    errors.recommendationFactors = "The recommendation factors must be an object.";

    return undefined;
  }

  return raw as Record<string, unknown>;
}

function optionalPeople(
  source: Record<string, unknown>,
  key: string,
  label: string,
  errors: Field
): number | undefined {
  const raw = source[key];

  if (raw === undefined || raw === null || raw === "") return undefined;

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_PEOPLE) {
    errors[key] = `${label} must be a whole number of people.`;

    return undefined;
  }

  return parsed;
}

export interface DispatchBody {
  teamId: string;
  missionNotes?: string;
  recommendationScore?: number;
  recommendationFactors?: Record<string, unknown>;
}

export function validateDispatch(body: unknown): DispatchBody {
  const source = asObject(body);
  const errors: Field = {};
  const teamId = requiredTeamId(source, errors);

  const dispatch: DispatchBody = {
    teamId,
    missionNotes: optionalText(source, "missionNotes", "Mission brief", errors, MAX_NOTES),
    recommendationScore: optionalScore(source, errors),
    recommendationFactors: optionalFactors(source, errors),
  };

  if (Object.keys(errors).length > 0) {
    fail("Fix the highlighted fields before dispatching.", errors);
  }

  return dispatch;
}

export interface StatusBody {
  status: DispatchStatus;
  note?: string;
  peopleRescued?: number;
  peopleEvacuated?: number;
}

export function validateStatus(body: unknown): StatusBody {
  const source = asObject(body);
  const errors: Field = {};

  const raw = typeof source.status === "string" ? source.status.trim().toUpperCase() : "";

  if (!(DISPATCH_STATUSES as readonly string[]).includes(raw)) {
    errors.status = `Choose a stage from: ${DISPATCH_STATUSES.join(", ")}.`;
  }

  const status = {
    note: optionalText(source, "note", "Note", errors, MAX_NOTE),
    peopleRescued: optionalPeople(source, "peopleRescued", "People rescued", errors),
    peopleEvacuated: optionalPeople(
      source,
      "peopleEvacuated",
      "People evacuated",
      errors
    ),
  };

  if (Object.keys(errors).length > 0) {
    fail("The mission stage could not be read.", errors);
  }

  return { status: raw as DispatchStatus, ...status };
}

export function validateReason(body: unknown): { reason?: string } {
  const source = asObject(body);
  const errors: Field = {};

  const reason = optionalText(source, "reason", "Reason", errors, MAX_NOTES);

  if (Object.keys(errors).length > 0) {
    fail("The reason could not be read.", errors);
  }

  return reason ? { reason } : {};
}

const MAX_HANDOVER = 300;

/**
 * Accepting a verified incident into the district. The note is optional because
 * the decision itself is the record; when one is written it is the handover line
 * the next shift reads, so it is still bounded and still has to be text.
 */
export function validateAcceptance(body: unknown): { note?: string } {
  const source =
    body === undefined || body === null ? {} : asObject(body);
  const errors: Field = {};

  const note = optionalText(source, "note", "Handover note", errors, MAX_HANDOVER);

  if (Object.keys(errors).length > 0) {
    fail("The handover note could not be read.", errors);
  }

  return note ? { note } : {};
}

const MAX_CLOSURE = 400;

/**
 * Closing an incident the district has finished with. The note is what a later
 * reader needs — who was handed over to, whether the citizen was reached, why no
 * team went — so it is bounded generously and never silently dropped.
 */
export function validateClosure(body: unknown): { note?: string } {
  const source = body === undefined || body === null ? {} : asObject(body);
  const errors: Field = {};

  const note = optionalText(source, "note", "Closing note", errors, MAX_CLOSURE);

  if (Object.keys(errors).length > 0) {
    fail("The closing note could not be read.", errors);
  }

  return note ? { note } : {};
}
