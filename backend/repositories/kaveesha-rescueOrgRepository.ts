import pool from "../config/db";
import type { AccountStatus } from "../models/registration";

export interface RescueOrganizationRow {
  user_id: string;
  organization_name: string;
  organization_type: string;
  registration_number: string;
  district: string;
  address: string;
  official_email: string;
  official_phone: string;
  admin_full_name: string;
  admin_designation: string;
  admin_email: string;
  admin_phone: string;
  created_at: Date;
  account_status: string;
  verified_at: Date | null;
}

export interface RescueTeamRow {
  user_id: string;
  team_name: string;
  team_type: string | null;
  leader_full_name: string;
  leader_designation: string | null;
  leader_email: string;
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
  affiliation: string;
  verified_by: string;
  account_status: string;
  rejection_reason: string | null;
  created_at: Date;
  reviewed_at: Date | null;
}

/**
 * The organization profile lives on rescue_organizations, but every request only
 * knows the authenticated subject (users.id), so the account status is joined in.
 */
export async function findRescueOrganizationByUserId(
  userId: string
): Promise<RescueOrganizationRow | null> {
  const result = await pool.query(
    `SELECT o.user_id, o.organization_name, o.organization_type,
            o.registration_number, o.district, o.address, o.official_email,
            o.official_phone, o.admin_full_name, o.admin_designation,
            o.admin_email, o.admin_phone, o.created_at,
            u.status AS account_status, u.verified_at
       FROM rescue_organizations o
       JOIN users u ON u.id = o.user_id
      WHERE o.user_id = $1
      LIMIT 1`,
    [userId]
  );

  return (result.rows[0] as RescueOrganizationRow) ?? null;
}

const TEAM_COLUMNS = `t.user_id, t.team_name, t.team_type, t.affiliation, t.verified_by,
       t.leader_full_name, t.leader_designation, t.leader_phone_number,
       t.team_contact_number, t.operating_district, t.member_count,
       t.capabilities, t.equipment, t.base_latitude, t.base_longitude,
       t.base_location_label, t.availability, t.reviewed_at, t.created_at,
       u.email AS leader_email, u.status AS account_status, u.rejection_reason`;

/**
 * Teams registered under this organization. Team leaders report their
 * organization by registration number, so that is the link we match on.
 */
export async function findTeamsByRegistrationNumber(
  registrationNumber: string
): Promise<RescueTeamRow[]> {
  const result = await pool.query(
    `SELECT ${TEAM_COLUMNS}
       FROM team_leaders t
       JOIN users u ON u.id = t.user_id
      WHERE t.organization_registration_number = $1
      ORDER BY t.created_at DESC`,
    [registrationNumber]
  );

  return result.rows as RescueTeamRow[];
}

/**
 * The team must belong to this organization and be waiting on this
 * organization's admin, so a leader cannot be approved by another one.
 */
export async function findTeamForReview(
  teamUserId: string,
  registrationNumber: string
): Promise<RescueTeamRow | null> {
  const result = await pool.query(
    `SELECT ${TEAM_COLUMNS}
       FROM team_leaders t
       JOIN users u ON u.id = t.user_id
      WHERE t.user_id = $1
        AND t.organization_registration_number = $2
        AND t.affiliation = 'ORGANIZATION'
        AND t.verified_by = 'ORGANIZATION_ADMIN'
      LIMIT 1`,
    [teamUserId, registrationNumber]
  );

  return (result.rows[0] as RescueTeamRow) ?? null;
}

/**
 * Records the organization admin's decision. users.verified_by_admin_id points
 * at super_admins only, so the reviewer of an organization team is kept on the
 * team row instead.
 */
export async function setTeamReviewOutcome(
  teamUserId: string,
  status: AccountStatus,
  options: { rejectionReason?: string | null; reviewerUserId: string }
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE users
          SET status = $2,
              rejection_reason = $3,
              verified_at = CASE WHEN $2::varchar = 'ACTIVE' THEN NOW() ELSE verified_at END,
              updated_at = NOW()
        WHERE id = $1`,
      [teamUserId, status, options.rejectionReason ?? null]
    );

    await client.query(
      `UPDATE team_leaders
          SET reviewed_by_user_id = $2,
              reviewed_at = NOW(),
              updated_at = NOW()
        WHERE user_id = $1`,
      [teamUserId, options.reviewerUserId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
