import {
  email,
  oneOf,
  type Validator,
} from "./registrationValidators";

export const LOGIN_INTERFACES = ["MOBILE_APP", "DMC_PORTAL"] as const;

const passwordPresent: Validator = (value) =>
  String(value ?? "").length > 0 ? null : "Password is required.";

export const loginRules: Record<string, Validator> = {
  email,
  password: passwordPresent,
  interface: oneOf("Interface", LOGIN_INTERFACES),
};