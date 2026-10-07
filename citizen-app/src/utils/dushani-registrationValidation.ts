export type FieldErrors = Record<string, string>;

export type Validator = (
  value: string,
  values: Record<string, string>
) => string | null;

const MOBILE_PREFIXES = [
  "070",
  "071",
  "072",
  "074",
  "075",
  "076",
  "077",
  "078",
];

const LANDLINE_AREA_CODES = [
  "011",
  "021",
  "023",
  "024",
  "025",
  "026",
  "027",
  "031",
  "032",
  "033",
  "034",
  "035",
  "036",
  "037",
  "038",
  "041",
  "045",
  "047",
  "051",
  "052",
  "054",
  "055",
  "057",
  "063",
  "065",
  "066",
  "067",
  "081",
  "091",
];

const PHONE_REGEX = new RegExp(
  `^(?:${[...MOBILE_PREFIXES, ...LANDLINE_AREA_CODES].join("|")})[0-9]{7}$`
);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/;
const ADDRESS_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{5,}$/;
const USERNAME_REGEX = /^[A-Za-z0-9._-]{3,20}$/;
const NIC_REGEX = /^(?:\d{9}[vVxX]|\d{12})$/;
const POSTAL_CODE_REGEX = /^\d{4,5}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeSriLankanNumber(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("0094")) return `0${digits.slice(4)}`;
  if (digits.startsWith("94")) return `0${digits.slice(2)}`;
  return digits;
}

function trimmed(value: string): string {
  return String(value ?? "").trim();
}

export function required(label: string, min = 2): Validator {
  return (value) => {
    const v = trimmed(value);
    if (!v) return `${label} is required.`;
    if (v.length < min) return `${label} must be at least ${min} characters.`;
    return null;
  };
}

export const email: Validator = (value) => {
  const v = trimmed(value);
  if (!v) return "Email is required.";
  if (!EMAIL_REGEX.test(v)) return "Please enter a valid email address.";
  return null;
};

export const phone: Validator = (value) => {
  const v = trimmed(value);
  if (!v) return "Phone number is required.";
  if (!PHONE_REGEX.test(normalizeSriLankanNumber(v))) {
    return "Enter a valid Sri Lankan number: 10 digits starting with a mobile prefix (070-078) or area code.";
  }
  return null;
};

export const address: Validator = (value) => {
  const v = trimmed(value);
  if (!v) return "Address is required.";
  if (!ADDRESS_REGEX.test(v)) {
    return "Address must be at least 5 characters and contain both letters and numbers.";
  }
  return null;
};

export const password: Validator = (value) => {
  const v = String(value ?? "");
  if (!v) return "Password is required.";
  if (!PASSWORD_REGEX.test(v)) {
    return "Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, and a number.";
  }
  return null;
};

export const confirmPassword: Validator = (value, values) => {
  if (String(value ?? "") !== String(values.password ?? "")) {
    return "Passwords do not match.";
  }
  return null;
};

export const username: Validator = (value) => {
  const v = trimmed(value);
  if (!v) return "Username is required.";
  if (!USERNAME_REGEX.test(v)) {
    return "Username must be 3-20 letters, numbers, dots, underscores or hyphens.";
  }
  return null;
};

export function optional(label: string, min = 2): Validator {
  return (value) => {
    const v = trimmed(value);
    if (!v) return null;
    if (v.length < min) return `${label} must be at least ${min} characters.`;
    return null;
  };
}

export const optionalNic: Validator = (value) => {
  const v = trimmed(value);
  if (!v) return null;
  if (!NIC_REGEX.test(v)) {
    return "NIC must be 9 digits followed by V or X, or 12 digits.";
  }
  return null;
};

export const optionalPostalCode: Validator = (value) => {
  const v = trimmed(value);
  if (!v) return null;
  if (!POSTAL_CODE_REGEX.test(v)) return "Postal code must be 4 or 5 digits.";
  return null;
};

export const optionalDateOfBirth: Validator = (value) => {
  const v = trimmed(value);
  if (!v) return null;
  if (!DATE_REGEX.test(v)) return "Date of birth must use the YYYY-MM-DD format.";
  const date = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== v) {
    return "Date of birth is not a real date.";
  }
  if (date.getTime() > Date.now()) return "Date of birth cannot be in the future.";
  return null;
};

export function positiveInteger(label: string): Validator {
  return (value) => {
    const v = trimmed(value);
    if (!v) return `${label} is required.`;
    const count = Number(v);
    if (!Number.isInteger(count) || count < 1) {
      return `${label} must be a whole number of at least 1.`;
    }
    return null;
  };
}

export const YES_NO = ["Yes", "No"] as const;

export const VEHICLE_TYPES = [
  "Motorcycle",
  "Three-Wheeler",
  "Car",
  "Van",
  "Lorry",
  "Other",
] as const;

const VEHICLE_REGISTRATION_REGEX = /^[A-Za-z]{1,3}[ -]?\d{1,5}[ -]?[A-Za-z]{0,2}$/;
const LICENSE_REGEX = /^[A-Za-z0-9-]{5,15}$/;

export function oneOf(label: string, allowed: readonly string[]): Validator {
  return (value) => {
    const v = trimmed(value);
    if (!v) return `${label} is required.`;
    if (!allowed.includes(v)) return `${label} is not a supported option.`;
    return null;
  };
}

export function yesNo(label: string): Validator {
  return (value) => {
    const v = trimmed(value);
    if (!v) return `${label} is required.`;
    if (!(YES_NO as readonly string[]).includes(v)) {
      return `Select Yes or No for ${label.toLowerCase()}.`;
    }
    return null;
  };
}

export function answeredYes(
  values: Record<string, string>,
  field: string
): boolean {
  return trimmed(values[field]) === "Yes";
}

export function requiredWhen(
  label: string,
  condition: (values: Record<string, string>) => boolean,
  min = 2
): Validator {
  return (value, values) => {
    if (!condition(values)) return null;
    return required(label, min)(value, values);
  };
}

export function patternWhen(
  label: string,
  condition: (values: Record<string, string>) => boolean,
  pattern: RegExp,
  message: string
): Validator {
  return (value, values) => {
    if (!condition(values)) return null;
    const v = trimmed(value);
    if (!v) return `${label} is required.`;
    if (!pattern.test(v)) return message;
    return null;
  };
}

export const vehicleHasVehicle: Validator = yesNo("Vehicle availability");

export const vehicleType: Validator = (value, values) =>
  answeredYes(values, "hasVehicle")
    ? oneOf("Vehicle type", VEHICLE_TYPES)(value, values)
    : null;

export const vehicleRegistrationNumber: Validator = patternWhen(
  "Vehicle registration number",
  (values) => answeredYes(values, "hasVehicle"),
  VEHICLE_REGISTRATION_REGEX,
  "Enter a valid vehicle registration number, like LR 4521 or KB-1234."
);

export const vehicleCapacity: Validator = requiredWhen("Vehicle capacity", (values) =>
  answeredYes(values, "hasVehicle")
);

export const drivingLicenseNumber: Validator = patternWhen(
  "Driving license number",
  (values) => answeredYes(values, "hasVehicle"),
  LICENSE_REGEX,
  "Driving license number must be 5-15 letters, numbers or hyphens."
);

export const VEHICLE_FIELDS = [
  "hasVehicle",
  "vehicleRegistrationNumber",
  "vehicleType",
  "vehicleCapacity",
  "drivingLicenseNumber",
  "driverName",
];

export function validateForm(
  values: Record<string, string>,
  rules: Record<string, Validator>
): FieldErrors {
  const errors: FieldErrors = {};

  for (const [field, rule] of Object.entries(rules)) {
    const message = rule(values[field] ?? "", values);
    if (message) errors[field] = message;
  }

  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function validateField(
  field: string,
  values: Record<string, string>,
  rules: Record<string, Validator>
): string | null {
  const rule = rules[field];
  if (!rule) return null;
  return rule(values[field] ?? "", values);
}
