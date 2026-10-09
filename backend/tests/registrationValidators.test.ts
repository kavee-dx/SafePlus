import {
  address,
  confirmPassword,
  email,
  nic,
  normalizeSriLankanNumber,
  optional,
  optionalDateOfBirth,
  optionalPostalCode,
  password,
  phone,
  required,
  username,
} from "../validators/registrationValidators";

const A_MESSAGE = expect.any(String);

describe("normalizeSriLankanNumber", () => {
  it.each([
    ["+94 77 123 4567", "0771234567"],
    ["0094771234567", "0771234567"],
    ["94771234567", "0771234567"],
    ["077 123 4567", "0771234567"],
    ["0771234567", "0771234567"],
  ])("folds %s to the local 10 digit form", (input, expected) => {
    expect(normalizeSriLankanNumber(input)).toBe(expected);
  });
});

describe("phone", () => {
  it.each(["0771234567", "0712345678", "0112345678", "+94 77 123 4567"])(
    "accepts %s",
    (value) => {
      expect(phone(value, {})).toBeNull();
    }
  );

  it.each(["0791234567", "1234", "077123", "abcdefghij"])(
    "rejects %s with the format hint",
    (value) => {
      expect(phone(value, {})).toMatch(/valid Sri Lankan number/);
    }
  );

  it("asks for a number rather than reporting a format problem when blank", () => {
    expect(phone("   ", {})).toBe("Phone number is required.");
  });
});

describe("email", () => {
  it.each([
    "officer@dmc.gov.lk",
    "dushani.naveendhya+tests@gmail.com",
    "a_b@sub.domain.org",
  ])("accepts %s", (value) => {
    expect(email(value, {})).toBeNull();
  });

  it.each(["no-at-sign", "a@b", "spaced in@example.com"])(
    "rejects %s",
    (value) => {
      expect(email(value, {})).toBe("Please enter a valid email address.");
    }
  );
});

describe("password", () => {
  it("needs upper, lower and a digit over eight characters", () => {
    expect(password("Strong1Pass", {})).toBeNull();
  });

  it.each([
    ["all lower", "strongpassword1"],
    ["no digit", "StrongPassword"],
    ["too short", "Str1ng"],
  ])("rejects a password that is %s", (_label, value) => {
    expect(password(value, {})).toEqual(A_MESSAGE);
  });

  it("matches the confirmation against the password in the same payload", () => {
    expect(confirmPassword("same1Pass", { password: "same1Pass" })).toBeNull();
    expect(confirmPassword("same1Pass", { password: "other1Pass" })).toEqual(
      A_MESSAGE
    );
  });
});

describe("identity and address fields", () => {
  it("accepts both the twelve digit and the legacy NIC forms", () => {
    expect(nic("200012345678", {})).toBeNull();
    expect(nic("981234567V", {})).toBeNull();
    expect(nic("981234567X", {})).toBeNull();
    expect(nic("2000123456789", {})).toEqual(A_MESSAGE);
    expect(nic("98123456", {})).toEqual(A_MESSAGE);
  });

  it("requires a street address that carries a number", () => {
    expect(address("No 12, Galle Road", {})).toBeNull();
    expect(address("Galle Road", {})).toMatch(/letters and numbers/);
  });

  it("keeps a username inside the login rules", () => {
    expect(username("dushani.n", {})).toBeNull();
    expect(username("a", {})).toEqual(A_MESSAGE);
    expect(username("has spaces", {})).toEqual(A_MESSAGE);
  });

  it("rejects a future date of birth but leaves the field optional", () => {
    expect(optionalDateOfBirth("", {})).toBeNull();
    expect(optionalDateOfBirth("1998-04-12", {})).toBeNull();
    expect(optionalDateOfBirth("2030-01-01", {})).toEqual(A_MESSAGE);
  });

  it("accepts a four or five digit postal code", () => {
    expect(optionalPostalCode("", {})).toBeNull();
    expect(optionalPostalCode("01300", {})).toBeNull();
    expect(optionalPostalCode("13", {})).toEqual(A_MESSAGE);
  });

  it("names the field it is complaining about", () => {
    expect(required("District", 2)("", {})).toBe("District is required.");
    expect(required("District", 3)("ab", {})).toBe(
      "District must be at least 3 characters."
    );
  });

  it("leaves an optional field alone until something is typed", () => {
    expect(optional("Vehicle", 2)("", {})).toBeNull();
    expect(optional("Vehicle", 2)("b", {})).toEqual(A_MESSAGE);
  });

  it("trims before measuring, so padding is not content", () => {
    expect(required("Name", 3)("  ab  ", {})).toEqual(A_MESSAGE);
  });
});
