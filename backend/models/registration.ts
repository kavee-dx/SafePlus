import * as rules from "../validators/registrationValidators";
import type { Validator } from "../validators/registrationValidators";

export type UserRole =
  | "CITIZEN"
  | "DELIVERY_VOLUNTEER"
  | "DELIVERY_VOLUNTEER_TEAM"
  | "FOOD_DONOR"
  | "RELIEF_AGENCY"
  | "ORGANIZATION_ADMIN"
  | "ORGANIZATION_TEAM_LEADER"
  | "INDEPENDENT_TEAM_LEADER"
  | "DISTRICT_OFFICER"
  | "COORDINATOR"
  | "DMC_OFFICER";

export type AccountStatus = "ACTIVE" | "PENDING_VERIFICATION";

export type InterfaceAccess = "MOBILE_APP" | "DMC_PORTAL";

export type Verifier = "SUPER_ADMIN" | "ORGANIZATION_ADMIN";

export const ROLE_INTERFACES: Record<UserRole, readonly InterfaceAccess[]> = {
  CITIZEN: ["MOBILE_APP"],
  DELIVERY_VOLUNTEER: ["MOBILE_APP"],
  DELIVERY_VOLUNTEER_TEAM: ["MOBILE_APP"],
  FOOD_DONOR: ["MOBILE_APP"],
  RELIEF_AGENCY: ["MOBILE_APP"],
  ORGANIZATION_ADMIN: ["DMC_PORTAL"],
  ORGANIZATION_TEAM_LEADER: ["MOBILE_APP", "DMC_PORTAL"],
  INDEPENDENT_TEAM_LEADER: ["MOBILE_APP", "DMC_PORTAL"],
  DISTRICT_OFFICER: ["DMC_PORTAL"],
  COORDINATOR: ["DMC_PORTAL"],
  DMC_OFFICER: ["DMC_PORTAL"],
};

export const INTERFACE_LABELS: Record<InterfaceAccess, string> = {
  MOBILE_APP: "SafePlus mobile app",
  DMC_PORTAL: "SafePlus DMC portal",
};

export type RegistrationPayload = Record<string, string>;

export interface NewUser {
  id: string;
  full_name: string;
  email: string;
  username: string | null;
  password_hash: string;
  phone_number: string | null;
  nic_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  postal_code: string | null;
  role: UserRole;
  status: AccountStatus;
}

export interface NewDeliveryVolunteer {
  user_id: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  has_vehicle: boolean;
  vehicle_registration_number: string | null;
  vehicle_type: string | null;
  vehicle_capacity: string | null;
  driving_license_number: string | null;
}

export interface NewDeliveryVolunteerTeam {
  user_id: string;
  team_name: string;
  team_registration_number: string | null;
  leader_full_name: string;
  leader_phone_number: string;
  address: string | null;
  operating_district: string;
  member_count: number;
  member_details: string | null;
  has_vehicle: boolean;
  vehicle_registration_number: string | null;
  vehicle_type: string | null;
  vehicle_capacity: string | null;
  driver_name: string | null;
  driving_license_number: string | null;
}

export type TeamLeaderAffiliation = "ORGANIZATION" | "INDEPENDENT";

export interface NewReliefAgency {
  user_id: string;
  agency_name: string;
  organization_type: string;
  registration_number: string;
  contact_person: string;
  contact_phone_number: string;
  address: string | null;
  district: string;
  operating_area: string | null;
}

export interface NewOrganizationAdmin {
  user_id: string;
  organization_name: string;
  organization_type: string;
  registration_number: string;
  contact_person: string;
  contact_phone_number: string;
  address: string | null;
  district: string;
  operating_area: string | null;
  rescue_team_count: number;
}

export interface NewTeamLeader {
  user_id: string;
  affiliation: TeamLeaderAffiliation;
  verified_by: Verifier;
  organization_name: string | null;
  organization_registration_number: string | null;
  team_name: string;
  leader_full_name: string;
  leader_phone_number: string;
  address: string | null;
  operating_district: string;
  member_count: number;
  member_details: string | null;
}

export interface NewDistrictOfficer {
  user_id: string;
  officer_id: string;
  assigned_district: string;
  divisional_secretariats: string | null;
  clearance_level: string;
  duty_phone_number: string;
}

export interface NewDmcOfficer {
  user_id: string;
  officer_id: string;
  designation: string;
  dmc_office: string;
  district: string;
  clearance_info: string | null;
}

export interface RegistrationTypeDefinition {
  role: UserRole;
  status: AccountStatus;
  verifiedBy: Verifier | null;
  interfaces: readonly InterfaceAccess[];
  validators: Record<string, Validator>;
  toUser: (
    payload: RegistrationPayload,
    passwordHash: string
  ) => Omit<NewUser, "id">;
  toDeliveryVolunteer?: (
    userId: string,
    payload: RegistrationPayload
  ) => NewDeliveryVolunteer;
  toDeliveryVolunteerTeam?: (
    userId: string,
    payload: RegistrationPayload
  ) => NewDeliveryVolunteerTeam;
  toOrganizationAdmin?: (
    userId: string,
    payload: RegistrationPayload
  ) => NewOrganizationAdmin;
  toReliefAgency?: (
    userId: string,
    payload: RegistrationPayload
  ) => NewReliefAgency;
  toTeamLeader?: (
    userId: string,
    payload: RegistrationPayload
  ) => NewTeamLeader;
  toDistrictOfficer?: (
    userId: string,
    payload: RegistrationPayload
  ) => NewDistrictOfficer;
  toDmcOfficer?: (
    userId: string,
    payload: RegistrationPayload
  ) => NewDmcOfficer;
}

const GENDERS = ["Male", "Female", "Other"] as const;

const ORGANIZATION_TYPES = [
  "Government Agency",
  "NGO",
  "Military",
  "Other Relief Organization",
] as const;

const RESCUE_ORGANIZATION_TYPES = [
  "Rescue Organization",
  "Volunteer Group",
  "NGO",
  "Military Unit",
  "Other",
] as const;

const DESIGNATIONS = [
  "DMC Duty Officer",
  "Assistant Director",
  "Senior Officer",
  "Field Officer",
] as const;

const CLEARANCE_LEVELS = [
  "Field Operations",
  "Resource and Logistics",
  "Full District Authority",
] as const;

function value(payload: RegistrationPayload, key: string): string {
  return String(payload[key] ?? "").trim();
}

function orNull(payload: RegistrationPayload, key: string): string | null {
  const v = value(payload, key);
  return v.length > 0 ? v : null;
}

function toCount(value: string): number {
  return Number.parseInt(value, 10);
}

const vehicleDeclared = (payload: RegistrationPayload) =>
  rules.answeredYes(payload, "hasVehicle");

function vehicleValue(
  payload: RegistrationPayload,
  key: string
): string | null {
  return vehicleDeclared(payload) ? orNull(payload, key) : null;
}

export function usernameFromEmail(email: string): string | null {
  const [localPart] = email.split("@");
  const cleaned = String(localPart ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, ".")
    .slice(0, 20);

  return cleaned.length >= 3 ? cleaned : null;
}

const sharedAccountRules: Record<string, Validator> = {
  username: rules.username,
  password: rules.password,
  confirmPassword: rules.confirmPassword,
};

const vehicleTypeRule: Validator = (value, payload) =>
  vehicleDeclared(payload)
    ? rules.oneOf("Vehicle type", rules.VEHICLE_TYPES)(value, payload)
    : null;

const vehicleValidators: Record<string, Validator> = {
  hasVehicle: rules.yesNo("Vehicle availability"),
  vehicleRegistrationNumber: rules.patternWhen(
    "Vehicle registration number",
    vehicleDeclared,
    rules.VEHICLE_REGISTRATION_REGEX,
    "Enter a valid vehicle registration number, like LR 4521 or KB-1234."
  ),
  vehicleType: vehicleTypeRule,
  vehicleCapacity: rules.requiredWhen("Vehicle capacity", vehicleDeclared),
  drivingLicenseNumber: rules.patternWhen(
    "Driving license number",
    vehicleDeclared,
    rules.LICENSE_REGEX,
    "Driving license number must be 5-15 letters, numbers or hyphens."
  ),
};

const teamLeaderRules: Record<string, Validator> = {
  teamName: rules.required("Team name"),
  leaderFullName: rules.required("Team leader full name"),
  nicNumber: rules.optionalNic,
  contactNumber: rules.phone,
  email: rules.email,
  teamAddress: rules.address,
  operatingDistrict: rules.required("Operating district"),
  numberOfMembers: rules.positiveInteger("Number of members"),
  teamMemberDetails: rules.required("Team member details"),
  ...sharedAccountRules,
};

function teamLeaderUser(
  role: UserRole,
  payload: RegistrationPayload,
  passwordHash: string
): Omit<NewUser, "id"> {
  return {
    full_name: value(payload, "leaderFullName"),
    email: value(payload, "email").toLowerCase(),
    username: orNull(payload, "username"),
    password_hash: passwordHash,
    phone_number: rules.normalizeSriLankanNumber(value(payload, "contactNumber")),
    nic_number: orNull(payload, "nicNumber"),
    date_of_birth: null,
    gender: null,
    address: orNull(payload, "teamAddress"),
    city: null,
    district: value(payload, "operatingDistrict"),
    postal_code: null,
    role,
    status: "PENDING_VERIFICATION",
  };
}

function teamLeaderProfile(
  userId: string,
  payload: RegistrationPayload,
  affiliation: TeamLeaderAffiliation,
  verifiedBy: Verifier
): NewTeamLeader {
  return {
    user_id: userId,
    affiliation,
    verified_by: verifiedBy,
    organization_name: orNull(payload, "organizationName"),
    organization_registration_number: orNull(
      payload,
      "organizationRegistrationNumber"
    ),
    team_name: value(payload, "teamName"),
    leader_full_name: value(payload, "leaderFullName"),
    leader_phone_number: rules.normalizeSriLankanNumber(
      value(payload, "contactNumber")
    ),
    address: orNull(payload, "teamAddress"),
    operating_district: value(payload, "operatingDistrict"),
    member_count: toCount(value(payload, "numberOfMembers")),
    member_details: orNull(payload, "teamMemberDetails"),
  };
}

const REGISTRATION_TYPE_DEFS: Record<
  string,
  Omit<RegistrationTypeDefinition, "interfaces">
> = {
  citizen: {
    role: "CITIZEN",
    status: "ACTIVE",
    verifiedBy: null,
    validators: {
      fullName: rules.required("Full name"),
      nicNumber: rules.optionalNic,
      dateOfBirth: rules.optionalDateOfBirth,
      gender: (v) =>
        !v.trim() || (GENDERS as readonly string[]).includes(v.trim())
          ? null
          : "Gender must be Male, Female or Other.",
      email: rules.email,
      mobileNumber: rules.phone,
      address: rules.address,
      city: rules.required("City"),
      district: rules.required("District"),
      postalCode: rules.optionalPostalCode,
      ...sharedAccountRules,
    },
    toUser: (payload, passwordHash) => ({
      full_name: value(payload, "fullName"),
      email: value(payload, "email").toLowerCase(),
      username: orNull(payload, "username"),
      password_hash: passwordHash,
      phone_number: rules.normalizeSriLankanNumber(value(payload, "mobileNumber")),
      nic_number: orNull(payload, "nicNumber"),
      date_of_birth: orNull(payload, "dateOfBirth"),
      gender: orNull(payload, "gender"),
      address: orNull(payload, "address"),
      city: orNull(payload, "city"),
      district: orNull(payload, "district"),
      postal_code: orNull(payload, "postalCode"),
      role: "CITIZEN",
      status: "ACTIVE",
    }),
  },

  "delivery-volunteer": {
    role: "DELIVERY_VOLUNTEER",
    status: "ACTIVE",
    verifiedBy: null,
    validators: {
      fullName: rules.required("Full name"),
      nicNumber: rules.optionalNic,
      email: rules.email,
      contactNumber: rules.phone,
      address: rules.address,
      city: rules.required("City"),
      district: rules.required("District"),
      emergencyContactName: rules.required("Emergency contact name"),
      emergencyContactNumber: rules.phone,
      ...vehicleValidators,
      ...sharedAccountRules,
    },
    toUser: (payload, passwordHash) => ({
      full_name: value(payload, "fullName"),
      email: value(payload, "email").toLowerCase(),
      username: orNull(payload, "username"),
      password_hash: passwordHash,
      phone_number: rules.normalizeSriLankanNumber(value(payload, "contactNumber")),
      nic_number: orNull(payload, "nicNumber"),
      date_of_birth: null,
      gender: null,
      address: orNull(payload, "address"),
      city: orNull(payload, "city"),
      district: value(payload, "district"),
      postal_code: null,
      role: "DELIVERY_VOLUNTEER",
      status: "ACTIVE",
    }),
    toDeliveryVolunteer: (userId, payload) => ({
      user_id: userId,
      emergency_contact_name: value(payload, "emergencyContactName"),
      emergency_contact_number: rules.normalizeSriLankanNumber(
        value(payload, "emergencyContactNumber")
      ),
      has_vehicle: vehicleDeclared(payload),
      vehicle_registration_number: vehicleValue(
        payload,
        "vehicleRegistrationNumber"
      ),
      vehicle_type: vehicleValue(payload, "vehicleType"),
      vehicle_capacity: vehicleValue(payload, "vehicleCapacity"),
      driving_license_number: vehicleValue(payload, "drivingLicenseNumber"),
    }),
  },

  "delivery-volunteer-team": {
    role: "DELIVERY_VOLUNTEER_TEAM",
    status: "ACTIVE",
    verifiedBy: null,
    validators: {
      teamName: rules.required("Team name"),
      teamRegistrationNumber: rules.optional("Team registration number"),
      teamLeaderName: rules.required("Team leader name"),
      teamLeaderContact: rules.phone,
      teamAddress: rules.address,
      operatingDistrict: rules.required("Operating district"),
      numberOfMembers: rules.positiveInteger("Number of members"),
      teamMemberDetails: rules.required("Team member details"),
      email: rules.email,
      driverName: rules.requiredWhen("Driver or responsible person", vehicleDeclared),
      ...vehicleValidators,
      ...sharedAccountRules,
    },
    toUser: (payload, passwordHash) => ({
      full_name: value(payload, "teamLeaderName"),
      email: value(payload, "email").toLowerCase(),
      username: orNull(payload, "username"),
      password_hash: passwordHash,
      phone_number: rules.normalizeSriLankanNumber(
        value(payload, "teamLeaderContact")
      ),
      nic_number: null,
      date_of_birth: null,
      gender: null,
      address: orNull(payload, "teamAddress"),
      city: null,
      district: value(payload, "operatingDistrict"),
      postal_code: null,
      role: "DELIVERY_VOLUNTEER_TEAM",
      status: "ACTIVE",
    }),
    toDeliveryVolunteerTeam: (userId, payload) => ({
      user_id: userId,
      team_name: value(payload, "teamName"),
      team_registration_number: orNull(payload, "teamRegistrationNumber"),
      leader_full_name: value(payload, "teamLeaderName"),
      leader_phone_number: rules.normalizeSriLankanNumber(
        value(payload, "teamLeaderContact")
      ),
      address: orNull(payload, "teamAddress"),
      operating_district: value(payload, "operatingDistrict"),
      member_count: toCount(value(payload, "numberOfMembers")),
      member_details: orNull(payload, "teamMemberDetails"),
      has_vehicle: vehicleDeclared(payload),
      vehicle_registration_number: vehicleValue(
        payload,
        "vehicleRegistrationNumber"
      ),
      vehicle_type: vehicleValue(payload, "vehicleType"),
      vehicle_capacity: vehicleValue(payload, "vehicleCapacity"),
      driver_name: vehicleValue(payload, "driverName"),
      driving_license_number: vehicleValue(payload, "drivingLicenseNumber"),
    }),
  },

  "food-donor": {
    role: "FOOD_DONOR",
    status: "ACTIVE",
    verifiedBy: null,
    validators: {
      fullName: rules.required("Full name"),
      nicNumber: rules.optionalNic,
      email: rules.email,
      contactNumber: rules.phone,
      address: rules.address,
      city: rules.required("City"),
      district: rules.required("District"),
      ...sharedAccountRules,
    },
    toUser: (payload, passwordHash) => ({
      full_name: value(payload, "fullName"),
      email: value(payload, "email").toLowerCase(),
      username: orNull(payload, "username"),
      password_hash: passwordHash,
      phone_number: rules.normalizeSriLankanNumber(value(payload, "contactNumber")),
      nic_number: orNull(payload, "nicNumber"),
      date_of_birth: null,
      gender: null,
      address: orNull(payload, "address"),
      city: orNull(payload, "city"),
      district: orNull(payload, "district"),
      postal_code: null,
      role: "FOOD_DONOR",
      status: "ACTIVE",
    }),
  },

  "relief-agency": {
    role: "RELIEF_AGENCY",
    status: "PENDING_VERIFICATION",
    verifiedBy: "SUPER_ADMIN",
    validators: {
      organizationName: rules.required("Organization name"),
      organizationType: rules.oneOf("Organization type", ORGANIZATION_TYPES),
      registrationNumber: rules.required("Registration number"),
      contactPerson: rules.required("Contact person"),
      contactNumber: rules.phone,
      email: rules.email,
      organizationAddress: rules.address,
      district: rules.required("District"),
      operatingArea: rules.optional("Operating area"),
      ...sharedAccountRules,
    },
    toUser: (payload, passwordHash) => ({
      full_name: value(payload, "contactPerson"),
      email: value(payload, "email").toLowerCase(),
      username: orNull(payload, "username"),
      password_hash: passwordHash,
      phone_number: rules.normalizeSriLankanNumber(value(payload, "contactNumber")),
      nic_number: null,
      date_of_birth: null,
      gender: null,
      address: orNull(payload, "organizationAddress"),
      city: null,
      district: value(payload, "district"),
      postal_code: null,
      role: "RELIEF_AGENCY",
      status: "PENDING_VERIFICATION",
    }),
    toReliefAgency: (userId, payload) => ({
      user_id: userId,
      agency_name: value(payload, "organizationName"),
      organization_type: value(payload, "organizationType"),
      registration_number: value(payload, "registrationNumber"),
      contact_person: value(payload, "contactPerson"),
      contact_phone_number: rules.normalizeSriLankanNumber(
        value(payload, "contactNumber")
      ),
      address: orNull(payload, "organizationAddress"),
      district: value(payload, "district"),
      operating_area: orNull(payload, "operatingArea"),
    }),
  },

  "organization-admin": {
    role: "ORGANIZATION_ADMIN",
    status: "PENDING_VERIFICATION",
    verifiedBy: "SUPER_ADMIN",
    validators: {
      organizationName: rules.required("Organization name"),
      organizationType: rules.oneOf(
        "Organization type",
        RESCUE_ORGANIZATION_TYPES
      ),
      registrationNumber: rules.required("Registration number"),
      contactPerson: rules.required("Contact person"),
      contactNumber: rules.phone,
      email: rules.email,
      organizationAddress: rules.address,
      district: rules.required("District"),
      operatingArea: rules.optional("Operating area"),
      numberOfRescueTeams: rules.positiveInteger("Number of rescue teams"),
      ...sharedAccountRules,
    },
    toUser: (payload, passwordHash) => ({
      full_name: value(payload, "contactPerson"),
      email: value(payload, "email").toLowerCase(),
      username: orNull(payload, "username"),
      password_hash: passwordHash,
      phone_number: rules.normalizeSriLankanNumber(value(payload, "contactNumber")),
      nic_number: null,
      date_of_birth: null,
      gender: null,
      address: orNull(payload, "organizationAddress"),
      city: null,
      district: value(payload, "district"),
      postal_code: null,
      role: "ORGANIZATION_ADMIN",
      status: "PENDING_VERIFICATION",
    }),
    toOrganizationAdmin: (userId, payload) => ({
      user_id: userId,
      organization_name: value(payload, "organizationName"),
      organization_type: value(payload, "organizationType"),
      registration_number: value(payload, "registrationNumber"),
      contact_person: value(payload, "contactPerson"),
      contact_phone_number: rules.normalizeSriLankanNumber(
        value(payload, "contactNumber")
      ),
      address: orNull(payload, "organizationAddress"),
      district: value(payload, "district"),
      operating_area: orNull(payload, "operatingArea"),
      rescue_team_count: toCount(value(payload, "numberOfRescueTeams")),
    }),
  },

  "organization-team-leader": {
    role: "ORGANIZATION_TEAM_LEADER",
    status: "PENDING_VERIFICATION",
    verifiedBy: "ORGANIZATION_ADMIN",
    validators: {
      organizationName: rules.required("Organization name"),
      organizationRegistrationNumber: rules.required(
        "Organization registration number"
      ),
      ...teamLeaderRules,
    },
    toUser: (payload, passwordHash) =>
      teamLeaderUser("ORGANIZATION_TEAM_LEADER", payload, passwordHash),
    toTeamLeader: (userId, payload) =>
      teamLeaderProfile(
        userId,
        payload,
        "ORGANIZATION",
        "ORGANIZATION_ADMIN"
      ),
  },

  "independent-team-leader": {
    role: "INDEPENDENT_TEAM_LEADER",
    status: "PENDING_VERIFICATION",
    verifiedBy: "SUPER_ADMIN",
    validators: {
      ...teamLeaderRules,
    },
    toUser: (payload, passwordHash) =>
      teamLeaderUser("INDEPENDENT_TEAM_LEADER", payload, passwordHash),
    toTeamLeader: (userId, payload) =>
      teamLeaderProfile(userId, payload, "INDEPENDENT", "SUPER_ADMIN"),
  },

  "district-officer": {
    role: "DISTRICT_OFFICER",
    status: "PENDING_VERIFICATION",
    verifiedBy: "SUPER_ADMIN",
    validators: {
      fullName: rules.required("Full name"),
      officerId: rules.officerId,
      officialEmail: rules.email,
      dutyPhoneNumber: rules.phone,
      assignedDistrict: rules.required("Assigned district"),
      divisionalSecretariats: rules.optional("Divisional secretariats"),
      clearanceLevel: rules.oneOf("Clearance level", CLEARANCE_LEVELS),
      password: rules.password,
      confirmPassword: rules.confirmPassword,
    },
    toUser: (payload, passwordHash) => ({
      full_name: value(payload, "fullName"),
      email: value(payload, "officialEmail").toLowerCase(),
      username:
        orNull(payload, "username") ??
        usernameFromEmail(value(payload, "officialEmail")),
      password_hash: passwordHash,
      phone_number: rules.normalizeSriLankanNumber(
        value(payload, "dutyPhoneNumber")
      ),
      nic_number: null,
      date_of_birth: null,
      gender: null,
      address: null,
      city: null,
      district: value(payload, "assignedDistrict"),
      postal_code: null,
      role: "DISTRICT_OFFICER",
      status: "PENDING_VERIFICATION",
    }),
    toDistrictOfficer: (userId, payload) => ({
      user_id: userId,
      officer_id: value(payload, "officerId"),
      assigned_district: value(payload, "assignedDistrict"),
      divisional_secretariats: orNull(payload, "divisionalSecretariats"),
      clearance_level: value(payload, "clearanceLevel"),
      duty_phone_number: rules.normalizeSriLankanNumber(
        value(payload, "dutyPhoneNumber")
      ),
    }),
  },

  coordinator: {
    role: "COORDINATOR",
    status: "PENDING_VERIFICATION",
    verifiedBy: "SUPER_ADMIN",
    validators: {
      fullName: rules.required("Full name"),
      email: rules.email,
      contactNumber: rules.phone,
      ...sharedAccountRules,
    },
    toUser: (payload, passwordHash) => ({
      full_name: value(payload, "fullName"),
      email: value(payload, "email").toLowerCase(),
      username: orNull(payload, "username"),
      password_hash: passwordHash,
      phone_number: rules.normalizeSriLankanNumber(value(payload, "contactNumber")),
      nic_number: null,
      date_of_birth: null,
      gender: null,
      address: null,
      city: null,
      district: null,
      postal_code: null,
      role: "COORDINATOR",
      status: "PENDING_VERIFICATION",
    }),
  },

  "dmc-officer": {
    role: "DMC_OFFICER",
    status: "PENDING_VERIFICATION",
    verifiedBy: "SUPER_ADMIN",
    validators: {
      fullName: rules.required("Full name"),
      officerId: rules.officerId,
      designation: rules.oneOf("Designation", DESIGNATIONS),
      officialEmail: rules.email,
      phoneNumber: rules.phone,
      dmcOffice: rules.required("DMC office"),
      district: rules.required("District"),
      clearanceInfo: rules.optional("Clearance information"),
      password: rules.password,
      confirmPassword: rules.confirmPassword,
    },
    toUser: (payload, passwordHash) => ({
      full_name: value(payload, "fullName"),
      email: value(payload, "officialEmail").toLowerCase(),
      username:
        orNull(payload, "username") ??
        usernameFromEmail(value(payload, "officialEmail")),
      password_hash: passwordHash,
      phone_number: rules.normalizeSriLankanNumber(value(payload, "phoneNumber")),
      nic_number: null,
      date_of_birth: null,
      gender: null,
      address: null,
      city: null,
      district: value(payload, "district"),
      postal_code: null,
      role: "DMC_OFFICER",
      status: "PENDING_VERIFICATION",
    }),
    toDmcOfficer: (userId, payload) => ({
      user_id: userId,
      officer_id: value(payload, "officerId"),
      designation: value(payload, "designation"),
      dmc_office: value(payload, "dmcOffice"),
      district: value(payload, "district"),
      clearance_info: orNull(payload, "clearanceInfo"),
    }),
  },
};

export const REGISTRATION_TYPES: Record<string, RegistrationTypeDefinition> =
  Object.fromEntries(
    Object.entries(REGISTRATION_TYPE_DEFS).map(([type, definition]) => [
      type,
      { ...definition, interfaces: ROLE_INTERFACES[definition.role] },
    ])
  );
