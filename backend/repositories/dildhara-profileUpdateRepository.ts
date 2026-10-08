import type { PoolClient } from "pg";

import { withTransaction } from "./registrationRepository";

interface RoleColumns {
  user: Record<string, string>; // field -> column in `users`
  table?: string; // the role's own table
  detail?: Record<string, string>; // field -> column in that table
}

const PERSON_USER = {
  fullName: "full_name",
  phoneNumber: "phone_number",
  nicNumber: "nic_number",
};

const PLACE_USER = { address: "address", city: "city", district: "district" };

const TEAM_USER = {
  leaderFullName: "full_name",
  leaderPhoneNumber: "phone_number",
  address: "address",
  operatingDistrict: "district",
};

const TEAM_DETAIL = {
  teamName: "team_name",
  leaderFullName: "leader_full_name",
  leaderPhoneNumber: "leader_phone_number",
  address: "address",
  operatingDistrict: "operating_district",
  memberCount: "member_count",
  memberDetails: "member_details",
};

const VEHICLE_DETAIL = {
  vehicleType: "vehicle_type",
  vehicleRegistrationNumber: "vehicle_registration_number",
  vehicleCapacity: "vehicle_capacity",
  drivingLicenseNumber: "driving_license_number",
};

const ROLE_COLUMNS: Record<string, RoleColumns> = {
  CITIZEN: {
    user: {
      ...PERSON_USER,
      dateOfBirth: "date_of_birth",
      gender: "gender",
      ...PLACE_USER,
      postalCode: "postal_code",
    },
  },
  FOOD_DONOR: { user: { ...PERSON_USER, ...PLACE_USER } },
  DELIVERY_VOLUNTEER: {
    user: { ...PERSON_USER, ...PLACE_USER },
    table: "delivery_volunteers",
    detail: {
      emergencyContactName: "emergency_contact_name",
      emergencyContactNumber: "emergency_contact_number",
      ...VEHICLE_DETAIL,
    },
  },
  DELIVERY_VOLUNTEER_TEAM: {
    user: TEAM_USER,
    table: "delivery_volunteer_teams",
    detail: { ...TEAM_DETAIL, driverName: "driver_name", ...VEHICLE_DETAIL },
  },
  RELIEF_AGENCY: {
    user: {
      contactPerson: "full_name",
      contactPhoneNumber: "phone_number",
      address: "address",
    },
    table: "relief_agencies",
    detail: {
      contactPerson: "contact_person",
      contactPhoneNumber: "contact_phone_number",
      address: "address",
      operatingArea: "operating_area",
    },
  },
  ORGANIZATION_TEAM_LEADER: {
    user: { ...TEAM_USER, nicNumber: "nic_number" },
    table: "team_leaders",
    detail: TEAM_DETAIL,
  },
  INDEPENDENT_TEAM_LEADER: {
    user: { ...TEAM_USER, nicNumber: "nic_number" },
    table: "team_leaders",
    detail: TEAM_DETAIL,
  },

  // ---- DMC portal roles ----
  DMC_OFFICER: {
    user: { fullName: "full_name", phoneNumber: "phone_number" },
    table: "dmc_officers",
    detail: { clearanceInfo: "clearance_info" },
  },
  DISTRICT_OFFICER: {
    user: { fullName: "full_name", phoneNumber: "phone_number" },
    table: "district_officers",
    detail: {
      divisionalSecretariats: "divisional_secretariats",
      phoneNumber: "duty_phone_number",
    },
  },
  COORDINATOR: {
    user: { fullName: "full_name", phoneNumber: "phone_number" },
  },
  ORGANIZATION_ADMIN: {
    user: {
      fullName: "full_name",
      phoneNumber: "phone_number",
      address: "address",
    },
    table: "organization_admins",
    detail: {
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
  const target = ROLE_COLUMNS[role];
  if (!target) return;

  await withTransaction(async (client) => {
    await updateRow(client, "users", "id", userId, changes, target.user);

    if (target.table && target.detail) {
      await updateRow(
        client,
        target.table,
        "user_id",
        userId,
        changes,
        target.detail
      );
    }
  });
}