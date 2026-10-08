import {
  address,
  optional,
  phone,
  positiveInteger,
  required,
  type Validator,
} from "./registrationValidators";

export const EDITABLE_FIELDS: Record<string, Record<string, Validator>> = {
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