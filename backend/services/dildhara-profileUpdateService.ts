import { ApiError } from "../utils/apiError";
import {
  normalizeSriLankanNumber,
  validatePayload,
} from "../validators/registrationValidators";
import { EDITABLE_FIELDS } from "../validators/dildhara-profileUpdateValidators";
import { findUserById } from "../repositories/dildhara-profileRepository";
import { updateProfileRows } from "../repositories/dildhara-profileUpdateRepository";
import { getMyProfile } from "./dildhara-profileService";

function normalize(field: string, raw: string): string | number | null {
  const value = raw.trim();

  if (field === "phoneNumber") return normalizeSriLankanNumber(value);
  if (field === "rescueTeamCount") return Number.parseInt(value, 10);

  return value === "" ? null : value;
}

export async function updateMyProfile(
  userId: string,
  body: Record<string, string>
) {
  const user = await findUserById(userId);

  if (!user) {
    throw new ApiError(401, "Account not found. Please sign in again.");
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(403, "Your account cannot be edited right now.");
  }

  const allowed = EDITABLE_FIELDS[String(user.role)];

  if (!allowed) {
    throw new ApiError(
      403,
      "Profile editing is not available for this account type yet."
    );
  }

  const submitted = Object.keys(allowed).filter((field) => field in body);

  if (submitted.length === 0) {
    throw new ApiError(400, "No editable fields were provided.");
  }

  const rules = Object.fromEntries(submitted.map((f) => [f, allowed[f]]));
  const fieldErrors = validatePayload(body, rules);

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError(
      400,
      "Please correct the highlighted fields and try again.",
      fieldErrors
    );
  }

  const changes = Object.fromEntries(
    submitted.map((field) => [field, normalize(field, body[field])])
  );

  await updateProfileRows(userId, String(user.role), changes);

  return getMyProfile(userId);
}