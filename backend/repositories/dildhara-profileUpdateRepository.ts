import type { PoolClient } from "pg";

import { withTransaction } from "./registrationRepository";

// field name used by the API -> column in the users table
const USER_COLUMNS: Record<string, string> = {
  fullName: "full_name",
  phoneNumber: "phone_number",
  address: "address",
};

// role -> role table and field -> column. A field may appear here AND in
// USER_COLUMNS when the value is stored in both places.
const DETAIL_TARGETS: Record<
  string,
  { table: string; columns: Record<string, string> }
> = {
  DMC_OFFICER: {
    table: "dmc_officers",
    columns: { clearanceInfo: "clearance_info" },
  },
  DISTRICT_OFFICER: {
    table: "district_officers",
    columns: {
      divisionalSecretariats: "divisional_secretariats",
      phoneNumber: "duty_phone_number",
    },
  },
  ORGANIZATION_ADMIN: {
    table: "organization_admins",
    columns: {
      fullName: "contact_person",
      phoneNumber: "contact_phone_number",
      address: "address",
      operatingArea: "operating_area",
      rescueTeamCount: "rescue_team_count",
    },
  },
};

async function updateRow(
  client: PoolClient,
  table: string,
  keyColumn: string,
  keyValue: string,
  changes: Record<string, unknown>,
  columnMap: Record<string, string>
): Promise<void> {
  const entries = Object.entries(changes).filter(([field]) =>
    Object.prototype.hasOwnProperty.call(columnMap, field)
  );

  if (entries.length === 0) return;

  const assignments = entries
    .map(([field], index) => `${columnMap[field]} = $${index + 1}`)
    .join(", ");

  await client.query(
    `UPDATE ${table} SET ${assignments} WHERE ${keyColumn} = $${entries.length + 1}`,
    [...entries.map(([, value]) => value), keyValue]
  );
}

export async function updateProfileRows(
  userId: string,
  role: string,
  changes: Record<string, unknown>
): Promise<void> {
  await withTransaction(async (client) => {
    await updateRow(client, "users", "id", userId, changes, USER_COLUMNS);

    const target = DETAIL_TARGETS[role];
    if (target) {
      await updateRow(
        client,
        target.table,
        "user_id",
        userId,
        changes,
        target.columns
      );
    }
  });
}