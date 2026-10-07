import {
  normalizeSriLankanNumber,
  optionalNic,
  officerId,
  password,
  phone,
  positiveInteger,
  readStringPayload,
  username,
  validatePayload,
  oneOf,
  email,
} from "../validators/registrationValidators";

describe("NIC validation", () => {
  it("accepts the old 9 digit + letter format", () => {
    expect(optionalNic("123456789V", {})).toBeNull();
    expect(optionalNic("123456789X", {})).toBeNull();
    expect(optionalNic("892145678v", {})).toBeNull();
  });

  it("accepts the new 12 digit format", () => {
    expect(optionalNic("123456789123", {})).toBeNull();
  });

  it("leaves the field alone when it is empty because it is optional", () => {
    expect(optionalNic("", {})).toBeNull();
  });

  it("rejects anything else", () => {
    expect(optionalNic("12345678", {})).toBe(
      "NIC must be 9 digits followed by V or X, or 12 digits."
    );
    expect(optionalNic("1234567890", {})).toBe(
      "NIC must be 9 digits followed by V or X, or 12 digits."
    );
    expect(optionalNic("123456789A", {})).toBe(
      "NIC must be 9 digits followed by V or X, or 12 digits."
    );
    expect(optionalNic("12345678912", {})).toBe(
      "NIC must be 9 digits followed by V or X, or 12 digits."
    );
  });
});

describe("phone validation", () => {
  it("normalises international prefixes before checking", () => {
    expect(normalizeSriLankanNumber("+94 77 123 4567")).toBe("0771234567");
    expect(normalizeSriLankanNumber("0094771234567")).toBe("0771234567");
    expect(phone("+94771234567", {})).toBeNull();
  });

  it("rejects numbers that are too short or from an unknown prefix", () => {
    expect(phone("0771234", {})).toContain("valid Sri Lankan number");
    expect(phone("0791234567", {})).toContain("valid Sri Lankan number");
  });
});

describe("account credentials", () => {
  it("requires upper, lower and a number", () => {
    expect(password("short1A", {})).toContain("at least 8 characters");
    expect(password("alllowercase1", {})).toContain("at least 8 characters");
    expect(password("Passw0rd1", {})).toBeNull();
  });

  it("keeps usernames to 3-20 safe characters", () => {
    expect(username("ab", {})).toContain("3-20");
    expect(username("has space", {})).toContain("3-20");
    expect(username("dushani.coord_1", {})).toBeNull();
  });

  it("accepts officer IDs with hyphens", () => {
    expect(officerId("DMC-10293", {})).toBeNull();
    expect(officerId("!", {})).toContain("4-30 letters");
  });
});

describe("payload helpers", () => {
  it("validates every rule and returns errors by field", () => {
    const errors = validatePayload(
      { fullName: "", email: "not-an-email" },
      { fullName: (v) => (v ? null : "Full name is required."), email }
    );

    expect(errors).toEqual({
      fullName: "Full name is required.",
      email: "Please enter a valid email address.",
    });
  });

  it("coerces numbers and drops unsupported value types", () => {
    expect(
      readStringPayload({
        numberOfMembers: 12,
        teamName: "  Alpha  ",
        nested: { a: 1 },
        missing: null,
      })
    ).toEqual({ numberOfMembers: "12", teamName: "  Alpha  ", missing: "" });
  });

  it("limits a field to a known option list", () => {
    const rule = oneOf("Organization type", ["NGO", "Military"]);

    expect(rule("NGO", {})).toBeNull();
    expect(rule("Company", {})).toBe("Organization type is not a supported option.");
    expect(rule("", {})).toBe("Organization type is required.");
  });

  it("requires whole positive counts", () => {
    const rule = positiveInteger("Number of members");

    expect(rule("8", {})).toBeNull();
    expect(rule("0", {})).toBe("Number of members must be a whole number of at least 1.");
    expect(rule("2.5", {})).toBe("Number of members must be a whole number of at least 1.");
  });
});
