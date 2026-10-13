jest.mock("bcrypt", () => ({
  hash: jest.fn(async (password: string) => `test-hash:${password}`),
  compare: jest.fn(
    async (password: string, hash: string) => hash === `test-hash:${password}`
  ),
  hashSync: jest.fn(() => "test-dummy-hash"),
}));

jest.mock("../repositories/registrationRepository", () => ({
  withTransaction: jest.fn(),
  insertUser: jest.fn(),
  insertDeliveryVolunteer: jest.fn(),
  insertDeliveryVolunteerTeam: jest.fn(),
  insertDmcOfficer: jest.fn(),
  insertDistrictOfficer: jest.fn(),
  insertOrganizationAdmin: jest.fn(),
  insertReliefAgency: jest.fn(),
  insertRescueOrganization: jest.fn(),
  insertRescueTeam: jest.fn(),
  insertTeamLeader: jest.fn(),
}));

jest.mock("../repositories/dildhara-authRepository", () => ({
  findUserByEmail: jest.fn(),
}));

import * as registrationRepository from "../repositories/registrationRepository";
import { findUserByEmail } from "../repositories/dildhara-authRepository";
import { loginAccount } from "../services/dildhara-authService";
import { registerAccount } from "../services/registrationService";

const registrationMethods = jest.mocked(registrationRepository);
const findUserMock = jest.mocked(findUserByEmail);
const password = "Strong1Pass";

function registrationPayload(type: string): Record<string, string> {
  const credentials = {
    email: type === "delivery-volunteer"
      ? "volunteer@example.com"
      : "team@example.com",
    username: type === "delivery-volunteer" ? "volunteer.one" : "team.one",
    password,
    confirmPassword: password,
    hasVehicle: "No",
  };

  if (type === "delivery-volunteer") {
    return {
      ...credentials,
      fullName: "Volunteer One",
      contactNumber: "0771234567",
      address: "No. 10, Main Street",
      city: "Colombo",
      district: "Colombo",
      emergencyContactName: "Emergency Contact",
      emergencyContactNumber: "0712345678",
    };
  }

  return {
    ...credentials,
    teamName: "Relief Team One",
    teamLeaderName: "Team Leader One",
    teamLeaderContact: "0771234567",
    teamAddress: "No. 20, Main Street",
    operatingDistrict: "Jaffna",
    numberOfMembers: "3",
    teamMemberDetails: "Two drivers and one helper",
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_USER_SECRET = "test-only-jwt-secret";
  registrationMethods.withTransaction.mockImplementation(async (work) =>
    work({} as never)
  );
  registrationMethods.insertUser.mockResolvedValue("registered-user-id");
  registrationMethods.insertDeliveryVolunteer.mockResolvedValue(undefined);
  registrationMethods.insertDeliveryVolunteerTeam.mockResolvedValue(undefined);
});

describe("delivery volunteer registration and authentication", () => {
  it.each(["delivery-volunteer", "delivery-volunteer-team"])(
    "registers a %s account with linked profile data and accepts its credentials",
    async (type) => {
      const payload = registrationPayload(type);
      const registered = await registerAccount(type, payload);
      const insertedUser = registrationMethods.insertUser.mock.calls[0][1];

      expect(registered).toMatchObject({
        email: payload.email,
        role:
          type === "delivery-volunteer"
            ? "DELIVERY_VOLUNTEER"
            : "DELIVERY_VOLUNTEER_TEAM",
        status: "ACTIVE",
        interfaces: ["MOBILE_APP"],
      });
      expect(insertedUser).toMatchObject({
        id: registered.id,
        email: payload.email,
        password_hash: `test-hash:${password}`,
        role: registered.role,
        status: "ACTIVE",
      });

      if (type === "delivery-volunteer") {
        expect(
          registrationMethods.insertDeliveryVolunteer
        ).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ user_id: registered.id })
        );
      } else {
        expect(
          registrationMethods.insertDeliveryVolunteerTeam
        ).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ user_id: registered.id })
        );
      }

      findUserMock.mockResolvedValue(insertedUser);
      const signedIn = await loginAccount({
        email: payload.email,
        password,
        interface: "MOBILE_APP",
      });

      expect(signedIn.account.id).toBe(registered.id);
      expect(signedIn.account.role).toBe(registered.role);
      expect(signedIn.token).toEqual(expect.any(String));
    }
  );

  it("rejects a delivery account login when the password is incorrect", async () => {
    findUserMock.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      full_name: "Volunteer One",
      email: "volunteer@example.com",
      username: "volunteer.one",
      password_hash: `test-hash:${password}`,
      role: "DELIVERY_VOLUNTEER",
      status: "ACTIVE",
    });

    await expect(
      loginAccount({
        email: "volunteer@example.com",
        password: "Wrong1Pass",
        interface: "MOBILE_APP",
      })
    ).rejects.toMatchObject({
      status: 401,
      message: "Invalid email or password.",
    });
  });
});
