import {
  drivingLicenseNumber,
  hasErrors,
  oneOf,
  patternWhen,
  requiredWhen,
  validateField,
  validateForm,
  vehicleCapacity,
  vehicleHasVehicle,
  vehicleRegistrationNumber,
  vehicleType,
  VEHICLE_FIELDS,
  VEHICLE_TYPES,
  yesNo,
  normalizeSriLankanNumber,
  phone,
} from "./dushani-registrationValidation";

const noVehicle = { hasVehicle: "No" };
const withVehicle = { hasVehicle: "Yes" };

describe("Sri Lankan number handling", () => {
  it("folds every written form of a local number onto 0xx", () => {
    expect(normalizeSriLankanNumber("0771234567")).toBe("0771234567");
    expect(normalizeSriLankanNumber("+94 77 123 4567")).toBe("0771234567");
    expect(normalizeSriLankanNumber("0094771234567")).toBe("0771234567");
    expect(normalizeSriLankanNumber("(077) 123-4567")).toBe("0771234567");
  });

  it("judges the number after it has been folded", () => {
    expect(phone("+94 77 123 4567", {})).toBeNull();
    expect(phone("0112233445", {})).toBeNull();
    expect(phone("07712", {})).toMatch(/valid Sri Lankan number/);
    expect(phone("", {})).toBe("Phone number is required.");
  });
});

describe("vehicle answers", () => {
  it("only asks for the vehicle once the officer says there is one", () => {
    expect(vehicleHasVehicle("", {})).toBe("Vehicle availability is required.");
    expect(yesNo("Vehicle availability")("Maybe", {})).toBe(
      "Select Yes or No for vehicle availability."
    );
  });

  it("stays quiet about every vehicle field when the answer is No", () => {
    expect(vehicleType("", noVehicle)).toBeNull();
    expect(vehicleRegistrationNumber("", noVehicle)).toBeNull();
    expect(vehicleCapacity("", noVehicle)).toBeNull();
    expect(drivingLicenseNumber("", noVehicle)).toBeNull();
  });

  it("demands the vehicle details when the answer is Yes", () => {
    expect(vehicleType("", withVehicle)).toBe("Vehicle type is required.");
    expect(vehicleRegistrationNumber("", withVehicle)).toBe(
      "Vehicle registration number is required."
    );
    expect(vehicleCapacity("", withVehicle)).toBe("Vehicle capacity is required.");
    expect(drivingLicenseNumber("", withVehicle)).toBe(
      "Driving license number is required."
    );
  });

  it("accepts the plate shapes citizens actually write", () => {
    expect(vehicleRegistrationNumber("LR 4521", withVehicle)).toBeNull();
    expect(vehicleRegistrationNumber("KB-1234", withVehicle)).toBeNull();
    expect(vehicleRegistrationNumber("WP 1234 K", withVehicle)).toBeNull();
    expect(vehicleRegistrationNumber("4521 LR", withVehicle)).toBe(
      "Enter a valid vehicle registration number, like LR 4521 or KB-1234."
    );
  });

  it("keeps the license number to letters, digits and hyphens", () => {
    expect(drivingLicenseNumber("DL-1234", withVehicle)).toBeNull();
    expect(drivingLicenseNumber("DL 1234", withVehicle)).toBe(
      "Driving license number must be 5-15 letters, numbers or hyphens."
    );
    expect(drivingLicenseNumber("DL", withVehicle)).toBe(
      "Driving license number must be 5-15 letters, numbers or hyphens."
    );
  });

  it("only offers vehicle types the register knows", () => {
    const rule = oneOf("Vehicle type", VEHICLE_TYPES);

    expect(rule("Car", withVehicle)).toBeNull();
    expect(rule("Boat", withVehicle)).toBe("Vehicle type is not a supported option.");
    expect(VEHICLE_FIELDS).toHaveLength(6);
  });
});

describe("form orchestration", () => {
  const rules = {
    hasVehicle: vehicleHasVehicle,
    vehicleType: vehicleType,
    district: requiredWhen("District", () => true, 3),
  };

  it("collects one message per broken field", () => {
    const errors = validateForm({ hasVehicle: "", district: "Co" }, rules);

    expect(errors).toEqual({
      hasVehicle: "Vehicle availability is required.",
      district: "District must be at least 3 characters.",
    });
    expect(hasErrors(errors)).toBe(true);
    expect(hasErrors({})).toBe(false);
  });

  it("revalidates a single field with the whole form in view", () => {
    expect(validateField("vehicleType", withVehicle, rules)).toBe(
      "Vehicle type is required."
    );
    expect(
      validateField("vehicleType", { ...withVehicle, vehicleType: "Van" }, rules)
    ).toBeNull();
    expect(validateField("unknownField", {}, rules)).toBeNull();
  });

  it("lets a pattern rule wait for its own condition", () => {
    const rule = patternWhen(
      "Code",
      (values) => values.needsCode === "Yes",
      /^\d{4}$/,
      "Code needs four digits."
    );

    expect(rule("12", { needsCode: "No" })).toBeNull();
    expect(rule("12", { needsCode: "Yes" })).toBe("Code needs four digits.");
    expect(rule("1234", { needsCode: "Yes" })).toBeNull();
  });
});
