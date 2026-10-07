import type { PoolClient } from "pg";

import pool from "../config/db";
import type {
  NewDeliveryVolunteer,
  NewDeliveryVolunteerTeam,
  NewDmcOfficer,
  NewDistrictOfficer,
  NewOrganizationAdmin,
  NewReliefAgency,
  NewTeamLeader,
  NewUser,
} from "../models/registration";

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function insertUser(
  client: PoolClient,
  user: NewUser
): Promise<string> {
  const result = await client.query(
    `INSERT INTO users (
        id, full_name, email, username, password_hash, phone_number,
        nic_number, date_of_birth, gender, address, city, district,
        postal_code, role, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id`,
    [
      user.id,
      user.full_name,
      user.email,
      user.username,
      user.password_hash,
      user.phone_number,
      user.nic_number,
      user.date_of_birth,
      user.gender,
      user.address,
      user.city,
      user.district,
      user.postal_code,
      user.role,
      user.status,
    ]
  );

  return result.rows[0].id as string;
}

export async function insertDeliveryVolunteer(
  client: PoolClient,
  volunteer: NewDeliveryVolunteer
): Promise<void> {
  await client.query(
    `INSERT INTO delivery_volunteers (
        id, user_id, emergency_contact_name, emergency_contact_number,
        has_vehicle, vehicle_registration_number, vehicle_type,
        vehicle_capacity, driving_license_number
     )
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      volunteer.user_id,
      volunteer.emergency_contact_name,
      volunteer.emergency_contact_number,
      volunteer.has_vehicle,
      volunteer.vehicle_registration_number,
      volunteer.vehicle_type,
      volunteer.vehicle_capacity,
      volunteer.driving_license_number,
    ]
  );
}

export async function insertDeliveryVolunteerTeam(
  client: PoolClient,
  team: NewDeliveryVolunteerTeam
): Promise<void> {
  await client.query(
    `INSERT INTO delivery_volunteer_teams (
        id, user_id, team_name, team_registration_number, leader_full_name,
        leader_phone_number, address, operating_district, member_count,
        member_details, has_vehicle, vehicle_registration_number,
        vehicle_type, vehicle_capacity, driver_name, driving_license_number
     )
     VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15
     )`,
    [
      team.user_id,
      team.team_name,
      team.team_registration_number,
      team.leader_full_name,
      team.leader_phone_number,
      team.address,
      team.operating_district,
      team.member_count,
      team.member_details,
      team.has_vehicle,
      team.vehicle_registration_number,
      team.vehicle_type,
      team.vehicle_capacity,
      team.driver_name,
      team.driving_license_number,
    ]
  );
}

export async function insertReliefAgency(
  client: PoolClient,
  agency: NewReliefAgency
): Promise<void> {
  await client.query(
    `INSERT INTO relief_agencies (
        id, user_id, agency_name, organization_type, registration_number,
        contact_person, contact_phone_number, address, district, operating_area
     )
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      agency.user_id,
      agency.agency_name,
      agency.organization_type,
      agency.registration_number,
      agency.contact_person,
      agency.contact_phone_number,
      agency.address,
      agency.district,
      agency.operating_area,
    ]
  );
}

export async function insertOrganizationAdmin(
  client: PoolClient,
  organization: NewOrganizationAdmin
): Promise<void> {
  await client.query(
    `INSERT INTO organization_admins (
        id, user_id, organization_name, organization_type, registration_number,
        contact_person, contact_phone_number, address, district, operating_area,
        rescue_team_count
     )
     VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
     )`,
    [
      organization.user_id,
      organization.organization_name,
      organization.organization_type,
      organization.registration_number,
      organization.contact_person,
      organization.contact_phone_number,
      organization.address,
      organization.district,
      organization.operating_area,
      organization.rescue_team_count,
    ]
  );
}

export async function insertTeamLeader(
  client: PoolClient,
  leader: NewTeamLeader
): Promise<void> {
  await client.query(
    `INSERT INTO team_leaders (
        id, user_id, affiliation, verified_by, organization_name,
        organization_registration_number, team_name, leader_full_name,
        leader_phone_number, address, operating_district, member_count,
        member_details
     )
     VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
     )`,
    [
      leader.user_id,
      leader.affiliation,
      leader.verified_by,
      leader.organization_name,
      leader.organization_registration_number,
      leader.team_name,
      leader.leader_full_name,
      leader.leader_phone_number,
      leader.address,
      leader.operating_district,
      leader.member_count,
      leader.member_details,
    ]
  );
}

export async function insertDistrictOfficer(
  client: PoolClient,
  officer: NewDistrictOfficer
): Promise<void> {
  await client.query(
    `INSERT INTO district_officers (
        id, user_id, officer_id, assigned_district, divisional_secretariats,
        clearance_level, duty_phone_number
     )
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
    [
      officer.user_id,
      officer.officer_id,
      officer.assigned_district,
      officer.divisional_secretariats,
      officer.clearance_level,
      officer.duty_phone_number,
    ]
  );
}

export async function insertDmcOfficer(
  client: PoolClient,
  officer: NewDmcOfficer
): Promise<void> {
  await client.query(
    `INSERT INTO dmc_officers (
        id, user_id, officer_id, designation, dmc_office, district, clearance_info
     )
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
    [
      officer.user_id,
      officer.officer_id,
      officer.designation,
      officer.dmc_office,
      officer.district,
      officer.clearance_info,
    ]
  );
}
