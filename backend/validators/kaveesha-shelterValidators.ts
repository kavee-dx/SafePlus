import { ApiError } from "../utils/apiError";

/* ------------------------------------------------------------------ *
 * Shelter request bodies.
 *
 * A shelter's identity and its district come from the officer who is writing,
 * never from a free-form field, so these validators only guard the shapes the
 * caller is genuinely allowed to choose: coordinates, capacity, headcounts and
 * the allocation lines. Numbers are the dangerous part — a fractional or wildly
 * large "people" value would corrupt the capacity trio — so each is bounded.
 * ------------------------------------------------------------------ */

type Field = Record<string, string>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_NAME = 120;
const MAX_ADDRESS = 300;
const MAX_TEXT = 300;
const MAX_FACILITIES = 20;
const MAX_PEOPLE = 1_000_000;
const MAX_MANAGER_SHELTERS = 50;

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "Send a JSON object.");
  }

  return value as Record<string, unknown>;
}

function fail(message: string, errors: Field): never {
  throw new ApiError(400, message, errors);
}

function requiredText(
  source: Record<string, unknown>,
  key: string,
  label: string,
  errors: Field,
  max: number
): string {
  const raw = typeof source[key] === "string" ? (source[key] as string).trim() : "";

  if (raw === "") {
    errors[key] = `${label} is required.`;
  } else if (raw.length > max) {
    errors[key] = `${label} must be ${max} characters or fewer.`;
  }

  return raw;
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

function requiredCoord(
  source: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  label: string,
  errors: Field
): number {
  const parsed = Number(source[key]);

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    errors[key] = `${label} must be a number between ${min} and ${max}.`;

    return NaN;
  }

  return parsed;
}

function requiredCapacity(
  source: Record<string, unknown>,
  errors: Field
): number {
  const parsed = Number(source.maxCapacity);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PEOPLE) {
    errors.maxCapacity = "Maximum capacity must be a whole number of at least 1.";

    return NaN;
  }

  return parsed;
}

function optionalPeople(
  source: Record<string, unknown>,
  key: string,
  label: string,
  errors: Field,
  min = 0
): number | undefined {
  const raw = source[key];

  if (raw === undefined || raw === null || raw === "") return undefined;

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < min || parsed > MAX_PEOPLE) {
    errors[key] = `${label} must be a whole number of ${min} or more.`;

    return undefined;
  }

  return parsed;
}

function facilities(
  source: Record<string, unknown>,
  errors: Field
): string[] | undefined {
  const raw = source.facilities;

  if (raw === undefined || raw === null) return undefined;

  if (!Array.isArray(raw) || raw.length > MAX_FACILITIES) {
    errors.facilities = `Facilities must be a list of up to ${MAX_FACILITIES} items.`;

    return undefined;
  }

  const list = raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item !== "");

  return list;
}

function uuidList(
  source: Record<string, unknown>,
  key: string,
  label: string,
  errors: Field,
  required: boolean
): string[] | undefined {
  const raw = source[key];

  if (raw === undefined || raw === null) {
    if (required) errors[key] = `${label} is required.`;

    return undefined;
  }

  if (!Array.isArray(raw) || raw.length > MAX_MANAGER_SHELTERS) {
    errors[key] = `${label} must be a list of up to ${MAX_MANAGER_SHELTERS} ids.`;

    return undefined;
  }

  const ids = raw.map((item) => (typeof item === "string" ? item.trim() : ""));

  if (ids.some((id) => !UUID.test(id))) {
    errors[key] = `Every ${label.toLowerCase()} must be a valid reference.`;

    return undefined;
  }

  return ids;
}

/* ------------------------------ shelter ------------------------------ */

export interface ShelterCreateBody {
  name: string;
  district?: string;
  address?: string;
  latitude: number;
  longitude: number;
  maxCapacity: number;
  facilities?: string[];
}

export function validateShelterCreate(body: unknown): ShelterCreateBody {
  const source = asObject(body);
  const errors: Field = {};

  const created: ShelterCreateBody = {
    name: requiredText(source, "name", "Shelter name", errors, MAX_NAME),
    district: optionalText(source, "district", "District", errors, MAX_NAME),
    address: optionalText(source, "address", "Address", errors, MAX_ADDRESS),
    latitude: requiredCoord(source, "latitude", -90, 90, "Latitude", errors),
    longitude: requiredCoord(source, "longitude", -180, 180, "Longitude", errors),
    maxCapacity: requiredCapacity(source, errors),
    facilities: facilities(source, errors),
  };

  if (Object.keys(errors).length > 0) {
    fail("The shelter could not be created from what you sent.", errors);
  }

  return created;
}

export function validateShelterPatch(body: unknown): {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  maxCapacity?: number;
  isActive?: boolean;
  facilities?: string[];
} {
  const source = asObject(body);
  const errors: Field = {};
  const patch: ReturnType<typeof validateShelterPatch> = {};

  if (source.name !== undefined) {
    patch.name = requiredText(source, "name", "Shelter name", errors, MAX_NAME);
  }

  if (source.address !== undefined) {
    patch.address = optionalText(source, "address", "Address", errors, MAX_ADDRESS);
  }

  if (source.latitude !== undefined) {
    patch.latitude = requiredCoord(source, "latitude", -90, 90, "Latitude", errors);
  }

  if (source.longitude !== undefined) {
    patch.longitude = requiredCoord(
      source,
      "longitude",
      -180,
      180,
      "Longitude",
      errors
    );
  }

  if (source.maxCapacity !== undefined) {
    patch.maxCapacity = requiredCapacity(source, errors);
  }

  if (source.isActive !== undefined) {
    if (typeof source.isActive !== "boolean") {
      errors.isActive = "Active must be true or false.";
    } else {
      patch.isActive = source.isActive;
    }
  }

  if (source.facilities !== undefined) {
    patch.facilities = facilities(source, errors);
  }

  if (Object.keys(errors).length > 0) {
    fail("The shelter could not be updated from what you sent.", errors);
  }

  if (Object.keys(patch).length === 0) {
    fail("Nothing to change. Send at least one field.", {});
  }

  return patch;
}

/* ------------------------------ allocation ------------------------------ */

export function validateAllocate(body: unknown): {
  allocations: { shelterId: string; count: number }[];
} {
  const source = asObject(body);
  const errors: Field = {};
  const raw = source.allocations;

  if (!Array.isArray(raw) || raw.length === 0) {
    errors.allocations = "Send at least one allocation line.";

    fail("The allocation plan could not be read.", errors);
  }

  const allocations = (raw as unknown[]).map((item, index) => {
    const line = (item ?? {}) as Record<string, unknown>;
    const shelterId = typeof line.shelterId === "string" ? line.shelterId.trim() : "";
    const count = Number(line.count);

    if (!UUID.test(shelterId)) {
      errors[`allocations.${index}.shelterId`] = "Each line needs a valid shelter.";
    }

    if (!Number.isInteger(count) || count < 1 || count > MAX_PEOPLE) {
      errors[`allocations.${index}.count`] =
        "Each line needs a whole number of people, at least 1.";
    }

    return { shelterId, count };
  });

  if (Object.keys(errors).length > 0) {
    fail("The allocation plan could not be read.", errors);
  }

  return { allocations };
}

/* ---------------------------- group creation ---------------------------- */

export function validateGroupCreate(body: unknown): {
  peopleCount: number;
  vulnerableCount?: number;
  district?: string;
  originLatitude?: number;
  originLongitude?: number;
} {
  const source = asObject(body);
  const errors: Field = {};

  const peopleCount = Number(source.peopleCount);

  if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > MAX_PEOPLE) {
    errors.peopleCount = "People count must be a whole number of at least 1.";
  }

  const created: ReturnType<typeof validateGroupCreate> = {
    peopleCount,
    vulnerableCount: optionalPeople(
      source,
      "vulnerableCount",
      "Vulnerable count",
      errors
    ),
    district: optionalText(source, "district", "District", errors, MAX_NAME),
  };

  if (source.originLatitude !== undefined && source.originLongitude !== undefined) {
    created.originLatitude = requiredCoord(
      source,
      "originLatitude",
      -90,
      90,
      "Origin latitude",
      errors
    );
    created.originLongitude = requiredCoord(
      source,
      "originLongitude",
      -180,
      180,
      "Origin longitude",
      errors
    );
  }

  if (Object.keys(errors).length > 0) {
    fail("The evacuee group could not be created.", errors);
  }

  return created;
}

/* --------------------------- manager accounts --------------------------- */

export function validateManagerCreate(body: unknown): {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  designation?: string;
  district?: string;
  shelterIds: string[];
} {
  const source = asObject(body);
  const errors: Field = {};

  const fullName = requiredText(source, "fullName", "Full name", errors, MAX_NAME);
  const email = requiredText(source, "email", "Email", errors, 200);

  if (email !== "" && !EMAIL.test(email)) {
    errors.email = "That does not look like an email address.";
  }

  const password =
    typeof source.password === "string" ? source.password : "";

  if (password.length < 8) {
    errors.password = "Set a temporary password of at least 8 characters.";
  }

  const shelterIds = uuidList(source, "shelterIds", "Shelters", errors, false) ?? [];

  const created = {
    fullName,
    email,
    password,
    phone: optionalText(source, "phone", "Phone", errors, 30),
    designation: optionalText(source, "designation", "Designation", errors, MAX_NAME),
    district: optionalText(source, "district", "District", errors, MAX_NAME),
    shelterIds,
  };

  if (Object.keys(errors).length > 0) {
    fail("The shelter manager account could not be created.", errors);
  }

  return created;
}

export function validateManagerPatch(body: unknown): {
  status?: "ACTIVE" | "SUSPENDED";
  shelterIds?: string[];
} {
  const source = asObject(body);
  const errors: Field = {};
  const patch: ReturnType<typeof validateManagerPatch> = {};

  if (source.status !== undefined) {
    const status = String(source.status).toUpperCase();

    if (status !== "ACTIVE" && status !== "SUSPENDED") {
      errors.status = "Status must be ACTIVE or SUSPENDED.";
    } else {
      patch.status = status;
    }
  }

  if (source.shelterIds !== undefined) {
    patch.shelterIds = uuidList(source, "shelterIds", "Shelters", errors, true);
  }

  if (Object.keys(errors).length > 0) {
    fail("The shelter manager could not be updated.", errors);
  }

  if (patch.status === undefined && patch.shelterIds === undefined) {
    fail("Send a status or a new shelter list.", {});
  }

  return patch;
}

/* ---------------------------- manager actions ---------------------------- */

export function validateConfirmArrival(body: unknown): {
  arrivedCount: number;
  discrepancyNote?: string;
} {
  const source = asObject(body);
  const errors: Field = {};

  const arrivedCount = optionalPeople(source, "arrivedCount", "Arrived count", errors, 0);

  if (arrivedCount === undefined) {
    errors.arrivedCount = "Say how many people arrived (0 is allowed).";
  }

  const discrepancyNote = optionalText(
    source,
    "discrepancyNote",
    "Discrepancy note",
    errors,
    MAX_TEXT
  );

  if (Object.keys(errors).length > 0) {
    fail("The arrival could not be confirmed.", errors);
  }

  return { arrivedCount: arrivedCount ?? 0, discrepancyNote };
}

export function validateWalkIn(body: unknown): {
  people: number;
  vulnerable?: number;
} {
  const source = asObject(body);
  const errors: Field = {};

  const people = optionalPeople(source, "people", "People", errors, 1);

  if (people === undefined) {
    errors.people = "Say how many people walked in.";
  }

  const vulnerable = optionalPeople(source, "vulnerable", "Vulnerable count", errors, 0);

  if (Object.keys(errors).length > 0) {
    fail("The walk-in could not be recorded.", errors);
  }

  return { people: people ?? 0, vulnerable };
}

export function validateDeparture(body: unknown): {
  people: number;
  reason?: string;
} {
  const source = asObject(body);
  const errors: Field = {};

  const people = optionalPeople(source, "people", "People", errors, 1);

  if (people === undefined) {
    errors.people = "Say how many people are leaving.";
  }

  const reason = optionalText(source, "reason", "Reason", errors, MAX_TEXT);

  if (Object.keys(errors).length > 0) {
    fail("The departure could not be recorded.", errors);
  }

  return { people: people ?? 0, reason };
}
