import pool from "../config/db";

export interface VerifiedOrganizationRow {
  source: string;
  name: string;
  type: string;
  registration_number: string;
  district: string;
  admin_user_id: string;
}

export interface RescueTeamRow {
  team_name: string;
  team_type: string | null;
  affiliation: string;
  verified_by: string;
  organization_name: string | null;
  organization_registration_number: string | null;
  leader_designation: string | null;
  leader_phone_number: string;
  team_contact_number: string | null;
  operating_district: string;
  member_count: number;
  capabilities: string[] | null;
  equipment: string[] | null;
  base_latitude: number | null;
  base_longitude: number | null;
  base_location_label: string | null;
  availability: string;
  created_at: Date;
  reviewed_at: Date | null;
  leader_full_name: string;
  leader_email: string;
  leader_nic_number: string | null;
  account_status: string;
  rejection_reason: string | null;
  verified_at: Date | null;
}

/**
 * Only verified organizations may be chosen by a team leader, so the owner
 * account has to be ACTIVE before the row is offered. Both organization
 * registrations are included because teams report a registration ID, not which
 * form their organization used.
 */
export async function listVerifiedOrganizations(): Promise<
  VerifiedOrganizationRow[]
> {
  const result = await pool.query<VerifiedOrganizationRow>(
    `SELECT 'RESCUE_ORGANIZATION' AS source,
            o.organization_name AS name,
            o.organization_type AS type,
            o.registration_number,
            o.district,
            o.user_id AS admin_user_id
       FROM rescue_organizations o
       JOIN users u ON u.id = o.user_id
      WHERE u.status = 'ACTIVE'
     UNION ALL
      SELECT 'ORGANIZATION_ADMIN',
            oa.organization_name,
            oa.organization_type,
            oa.registration_number,
            oa.district,
            oa.user_id
       FROM organization_admins oa
       JOIN users u ON u.id = oa.user_id
      WHERE u.status = 'ACTIVE'
      ORDER BY name ASC`
  );

  const seen = new Set<string>();

  return result.rows.filter((row) => {
    const key = row.registration_number.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function findRescueTeamByUserId(
  userId: string
): Promise<RescueTeamRow | null> {
  const result = await pool.query(
    `SELECT t.team_name, t.team_type, t.affiliation, t.verified_by,
            t.organization_name, t.organization_registration_number,
            t.leader_designation, t.leader_phone_number, t.team_contact_number,
            t.operating_district, t.member_count, t.capabilities, t.equipment,
            t.base_latitude, t.base_longitude, t.base_location_label,
            t.availability, t.created_at, t.reviewed_at,
            u.full_name AS leader_full_name, u.email AS leader_email,
            u.nic_number AS leader_nic_number, u.status AS account_status,
            u.rejection_reason, u.verified_at
       FROM team_leaders t
       JOIN users u ON u.id = t.user_id
      WHERE t.user_id = $1
      LIMIT 1`,
    [userId]
  );

  return (result.rows[0] as RescueTeamRow) ?? null;
}

export interface RescueTeamUpdate {
  team_name: string;
  team_type: string;
  operating_district: string;
  member_count: number;
  team_contact_number: string;
  capabilities: string[];
  equipment: string[];
  base_latitude: number;
  base_longitude: number;
  base_location_label: string | null;
  leader_designation: string | null;
  organization_name: string | null;
  organization_registration_number: string | null;
}

/**
 * A rejected leader edits the same row and goes back to the queue that already
 * owns it, so affiliation and verified_by are never rewritten here.
 */
export async function updateRescueTeam(
  userId: string,
  team: RescueTeamUpdate
): Promise<void> {
  await pool.query(
    `UPDATE team_leaders
        SET team_name = $2,
            team_type = $3,
            operating_district = $4,
            member_count = $5,
            team_contact_number = $6,
            capabilities = $7,
            equipment = $8,
            base_latitude = $9,
            base_longitude = $10,
            base_location_label = $11,
            leader_designation = $12,
            organization_name = $13,
            organization_registration_number = $14,
            address = COALESCE($15, address),
            updated_at = NOW()
      WHERE user_id = $1`,
    [
      userId,
      team.team_name,
      team.team_type,
      team.operating_district,
      team.member_count,
      team.team_contact_number,
      team.capabilities,
      team.equipment,
      team.base_latitude,
      team.base_longitude,
      team.base_location_label,
      team.leader_designation,
      team.organization_name,
      team.organization_registration_number,
      // address is text while base_location_label is varchar. Reusing one
      // parameter for both columns makes Postgres refuse to deduce a single
      // type, so the label is passed a second time for the legacy address.
      team.base_location_label,
    ]
  );
}

/** Sends the edited team back to whichever queue verifies this affiliation. */
export async function resendTeamForReview(userId: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE users
          SET status = 'PENDING_VERIFICATION',
              rejection_reason = NULL,
              verified_at = NULL,
              updated_at = NOW()
        WHERE id = $1`,
      [userId]
    );

    await client.query(
      `UPDATE team_leaders
          SET reviewed_at = NULL,
              reviewed_by_user_id = NULL,
              updated_at = NOW()
        WHERE user_id = $1`,
      [userId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setTeamAvailability(
  userId: string,
  availability: string
): Promise<void> {
  await pool.query(
    `UPDATE team_leaders
        SET availability = $2, updated_at = NOW()
      WHERE user_id = $1`,
    [userId, availability]
  );
}
