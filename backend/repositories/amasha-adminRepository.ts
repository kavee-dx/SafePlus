import pool from "../config/db";
import {
  SUPER_ADMIN_REVIEWABLE_ROLES,
  type AccountStatus,
  type UserRole,
} from "../models/registration";

export interface SuperAdminRecord {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
}

export interface ProfileField {
  label: string;
  value: string;
}

export interface RegistrationRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: AccountStatus;
  district: string | null;
  rejectionReason: string | null;
  createdAt: string;
  verifiedAt: string | null;
  profile: ProfileField[];
}

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  role: UserRole;
  status: AccountStatus;
  district: string | null;
  rejection_reason: string | null;
  created_at: string;
  verified_at: string | null;
}

export async function findSuperAdminByEmail(
  email: string
): Promise<SuperAdminRecord | null> {
  const result = await pool.query(
    `SELECT id, full_name, email, password_hash
       FROM super_admins
      WHERE email = $1
      LIMIT 1`,
    [email]
  );

  return (result.rows[0] as SuperAdminRecord) ?? null;
}

export async function findSuperAdminById(
  id: string
): Promise<{ id: string; fullName: string; email: string } | null> {
  const result = await pool.query(
    `SELECT id, full_name, email FROM super_admins WHERE id = $1 LIMIT 1`,
    [id]
  );

  const row = result.rows[0];
  if (!row) return null;

  return { id: row.id, fullName: row.full_name, email: row.email };
}

// ---- Profile builders: turn each role's profile row into label/value pairs ----

type ProfileBuilder = (row: Record<string, unknown>) => ProfileField[];

function text(label: string, value: unknown): ProfileField | null {
  if (value === null || value === undefined || value === "") return null;
  return { label, value: String(value) };
}

function fields(
  row: Record<string, unknown>,
  defs: [string, string][]
): ProfileField[] {
  const out: ProfileField[] = [];
  for (const [label, key] of defs) {
    const field = text(label, row[key]);
    if (field) out.push(field);
  }
  return out;
}

const PROFILE_TABLES: Record<
  string,
  { table: string; build: ProfileBuilder }
> = {
  DISTRICT_OFFICER: {
    table: "district_officers",
    build: (row) =>
      fields(row, [
        ["Officer ID", "officer_id"],
        ["Assigned District", "assigned_district"],
        ["Divisional Secretariats", "divisional_secretariats"],
        ["Clearance Level", "clearance_level"],
        ["Duty Phone", "duty_phone_number"],
      ]),
  },
  DMC_OFFICER: {
    table: "dmc_officers",
    build: (row) =>
      fields(row, [
        ["Officer ID", "officer_id"],
        ["Designation", "designation"],
        ["DMC Office", "dmc_office"],
        ["District", "district"],
        ["Clearance Info", "clearance_info"],
      ]),
  },
  RELIEF_AGENCY: {
    table: "relief_agencies",
    build: (row) =>
      fields(row, [
        ["Agency Name", "agency_name"],
        ["Organization Type", "organization_type"],
        ["Registration Number", "registration_number"],
        ["Contact Person", "contact_person"],
        ["Contact Phone", "contact_phone_number"],
        ["Address", "address"],
        ["District", "district"],
        ["Operating Area", "operating_area"],
      ]),
  },
  ORGANIZATION_ADMIN: {
    table: "organization_admins",
    build: (row) =>
      fields(row, [
        ["Organization Name", "organization_name"],
        ["Organization Type", "organization_type"],
        ["Registration Number", "registration_number"],
        ["Contact Person", "contact_person"],
        ["Contact Phone", "contact_phone_number"],
        ["Address", "address"],
        ["District", "district"],
        ["Operating Area", "operating_area"],
        ["Rescue Team Count", "rescue_team_count"],
      ]),
  },
  INDEPENDENT_TEAM_LEADER: {
    table: "team_leaders",
    build: (row) =>
      fields(row, [
        ["Team Name", "team_name"],
        ["Affiliation", "affiliation"],
        ["Leader Full Name", "leader_full_name"],
        ["Leader Phone", "leader_phone_number"],
        ["Address", "address"],
        ["Operating District", "operating_district"],
        ["Member Count", "member_count"],
        ["Member Details", "member_details"],
      ]),
  },
};

async function loadProfiles(
  rows: UserRow[]
): Promise<Map<string, ProfileField[]>> {
  const profiles = new Map<string, ProfileField[]>();

  // Group user ids by role so each profile table is queried once.
  const idsByRole = new Map<string, string[]>();
  for (const row of rows) {
    if (!PROFILE_TABLES[row.role]) continue;
    const list = idsByRole.get(row.role) ?? [];
    list.push(row.id);
    idsByRole.set(row.role, list);
  }

  for (const [role, ids] of idsByRole.entries()) {
    const config = PROFILE_TABLES[role];
    const result = await pool.query(
      `SELECT * FROM ${config.table} WHERE user_id = ANY($1::uuid[])`,
      [ids]
    );

    for (const profileRow of result.rows) {
      profiles.set(profileRow.user_id, config.build(profileRow));
    }
  }

  return profiles;
}

function toRecord(row: UserRow, profile: ProfileField[]): RegistrationRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone_number,
    role: row.role,
    status: row.status,
    district: row.district,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    verifiedAt: row.verified_at,
    profile,
  };
}

export interface ListFilters {
  status?: AccountStatus | "ALL";
  role?: UserRole | "ALL";
}

export async function listRegistrationsForReview(
  filters: ListFilters = {}
): Promise<RegistrationRecord[]> {
  const { status, role } = filters;

  const conditions = ["role = ANY($1::varchar[])"];
  const params: unknown[] = [[...SUPER_ADMIN_REVIEWABLE_ROLES]];

  if (status && status !== "ALL") {
    params.push(status);
    conditions.push(`status = $${params.length}::varchar`);
  }

  if (role && role !== "ALL") {
    params.push(role);
    conditions.push(`role = $${params.length}::varchar`);
  }

  const result = await pool.query(
    `SELECT id, full_name, email, phone_number, role, status, district,
            rejection_reason, created_at, verified_at
       FROM users
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC`,
    params
  );

  const rows = result.rows as UserRow[];
  const profiles = await loadProfiles(rows);

  return rows.map((row) => toRecord(row, profiles.get(row.id) ?? []));
}

export async function findRegistrationById(
  id: string
): Promise<RegistrationRecord | null> {
  const result = await pool.query(
    `SELECT id, full_name, email, phone_number, role, status, district,
            rejection_reason, created_at, verified_at
       FROM users
      WHERE id = $1 AND role = ANY($2::varchar[])
      LIMIT 1`,
    [id, [...SUPER_ADMIN_REVIEWABLE_ROLES]]
  );

  const row = result.rows[0] as UserRow | undefined;
  if (!row) return null;

  const profiles = await loadProfiles([row]);
  return toRecord(row, profiles.get(row.id) ?? []);
}

export async function setUserStatus(
  id: string,
  status: AccountStatus,
  options: { rejectionReason?: string | null; adminId?: string | null } = {}
): Promise<void> {
  await pool.query(
    `UPDATE users
        SET status = $2,
            rejection_reason = $3,
            verified_at = NOW(),
            verified_by_admin_id = $4,
            updated_at = NOW()
      WHERE id = $1`,
    [
      id,
      status,
      options.rejectionReason ?? null,
      options.adminId ?? null,
    ]
  );
}

export async function countRegistrationsByStatus(): Promise<
  Record<string, number>
> {
  const result = await pool.query(
    `SELECT status, COUNT(*)::int AS count
       FROM users
      WHERE role = ANY($1::varchar[])
      GROUP BY status`,
    [[...SUPER_ADMIN_REVIEWABLE_ROLES]]
  );

  const counts: Record<string, number> = {
    PENDING_VERIFICATION: 0,
    ACTIVE: 0,
    REJECTED: 0,
    SUSPENDED: 0,
  };

  for (const row of result.rows) {
    counts[row.status] = row.count;
  }

  return counts;
}
