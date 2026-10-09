import { ApiError } from "../utils/apiError";
import type { UserRole } from "../models/registration";
import {
  findRoleDetails,
  findUserById,
} from "../repositories/dildhara-profileRepository";

const DETAIL_TABLES: Partial<Record<UserRole, string>> = {
  DELIVERY_VOLUNTEER: "delivery_volunteers",
  DELIVERY_VOLUNTEER_TEAM: "delivery_volunteer_teams",
  RELIEF_AGENCY: "relief_agencies",
  ORGANIZATION_ADMIN: "organization_admins",
  RESCUE_ORGANIZATION_ADMIN: "rescue_organizations",
  ORGANIZATION_TEAM_LEADER: "team_leaders",
  INDEPENDENT_TEAM_LEADER: "team_leaders",
  DISTRICT_OFFICER: "district_officers",
  DMC_OFFICER: "dmc_officers",
};

function formatValue(value: unknown): unknown {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return value;
}

function toCamel(
  row: Record<string, unknown>,
  exclude: string[] = []
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !exclude.includes(key))
      .map(([key, value]) => [
        key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
        formatValue(value),
      ])
  );
}

export async function getMyProfile(userId: string) {
  const userRow = await findUserById(userId);

  if (!userRow) {
    throw new ApiError(401, "Account not found. Please sign in again.");
  }

  const table = DETAIL_TABLES[userRow.role as UserRole];
  const detailRow = table ? await findRoleDetails(table, userId) : null;

  return {
    user: toCamel(userRow),
    details: detailRow ? toCamel(detailRow, ["id", "user_id"]) : null,
  };
}