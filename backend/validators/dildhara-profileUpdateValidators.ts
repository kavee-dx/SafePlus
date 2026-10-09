import {
  LICENSE_REGEX,
  VEHICLE_REGISTRATION_REGEX,
  VEHICLE_TYPES,
  address,
  oneOf,
  optional,
  optionalDateOfBirth,
  optionalNic,
  optionalPostalCode,
  patternWhen,
  phone,
  positiveInteger,
  required,
  requiredWhen,
  type Validator,
} from "./registrationValidators";

const GENDERS = ["Male", "Female", "Other"] as const;

const gender: Validator = (value) => {
  const v = String(value ?? "").trim();
  if (!v || (GENDERS as readonly string[]).includes(v)) return null;
  return "Gender must be Male, Female or Other.";
};

const always = () => true;

// These only make sense for someone who already has a vehicle registered.
// The service rejects them otherwise (see VEHICLE_FIELDS).
const vehicleRules: Record<string, Validator> = {
  vehicleType: oneOf("Vehicle type", VEHICLE_TYPES),
  vehicleRegistrationNumber: patternWhen(
    "Vehicle registration number",
    always,
    VEHICLE_REGISTRATION_REGEX,
    "Enter a valid vehicle registration number, like LR 4521 or KB-1234."
  ),
  vehicleCapacity: requiredWhen("Vehicle capacity", always),
  drivingLicenseNumber: patternWhen(
    "Driving license number",
    always,
    LICENSE_REGEX,
    "Driving license number must be 5-15 letters, numbers or hyphens."
  ),
};

export const VEHICLE_FIELDS = new Set<string>([
  ...Object.keys(vehicleRules),
  "driverName",
]);

const person: Record<string, Validator> = {
  fullName: required("Full name"),
  phoneNumber: phone,
  nicNumber: optionalNic,
};

const place: Record<string, Validator> = {
  address,
  city: required("City"),
  district: required("District"),
};

const team: Record<string, Validator> = {
  teamName: required("Team name"),
  leaderFullName: required("Team leader full name"),
  leaderPhoneNumber: phone,
  address,
  operatingDistrict: required("Operating district"),
  memberCount: positiveInteger("Number of members"),
  memberDetails: required("Team member details"),
};

export const EDITABLE_FIELDS: Record<string, Record<string, Validator>> = {
  // ---- Mobile app roles ----
  CITIZEN: {
    ...person,
    dateOfBirth: optionalDateOfBirth,
    gender,
    ...place,
    postalCode: optionalPostalCode,
  },
  FOOD_DONOR: { ...person, ...place },
  DELIVERY_VOLUNTEER: {
    ...person,
    ...place,
    emergencyContactName: required("Emergency contact name"),
    emergencyContactNumber: phone,
    ...vehicleRules,
  },
  DELIVERY_VOLUNTEER_TEAM: {
    ...team,
    driverName: requiredWhen("Driver or responsible person", always),
    ...vehicleRules,
  },
  RELIEF_AGENCY: {
    contactPerson: required("Contact person"),
    contactPhoneNumber: phone,
    address,
    operatingArea: optional("Operating area"),
  },
  ORGANIZATION_TEAM_LEADER: { ...team, nicNumber: optionalNic },
  INDEPENDENT_TEAM_LEADER: { ...team, nicNumber: optionalNic },

  // ---- DMC portal roles ----
  DMC_OFFICER: {
    fullName: required("Full name"),
    phoneNumber: phone,
    clearanceInfo: optional("Clearance information"),
  },
  DISTRICT_OFFICER: {
    fullName: required("Full name"),
    phoneNumber: phone,
    divisionalSecretariats: optional("Divisional secretariats"),
  },
  COORDINATOR: {
    fullName: required("Full name"),
    phoneNumber: phone,
  },
  ORGANIZATION_ADMIN: {
    fullName: required("Contact person"),
    phoneNumber: phone,
    address,
    operatingArea: optional("Operating area"),
    rescueTeamCount: positiveInteger("Number of rescue teams"),
  },
};