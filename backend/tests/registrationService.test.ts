jest.mock("bcrypt");
jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), connect: jest.fn() },
}));
jest.mock("../repositories/registrationRepository");

import bcrypt from "bcrypt";

import {
  insertDeliveryVolunteer,
  insertDeliveryVolunteerTeam,
  insertDmcOfficer,
  insertDistrictOfficer,
  insertOrganizationAdmin,
  insertReliefAgency,
  insertTeamLeader,
  insertUser,
  withTransaction,
} from "../repositories/registrationRepository";
import { registerAccount } from "../services/registrationService";
import { ApiError } from "../utils/apiError";

const mockedHash = bcrypt.hash as unknown as jest.Mock<Promise<string>, [string, number]>;
const mockedTransaction = withTransaction as unknown as jest.Mock;
const mockedInsertUser = insertUser as unknown as jest.Mock;

const citizenPayload = {
  fullName: "Dushani Naveendhya",
  nicNumber: "123456789V",
  dateOfBirth: "1998-04-12",
  gender: "Female",
  email: "Dushani@Example.com",
  mobileNumber: "+94 77 123 4567",
  address: "No. 12, Galle Road",
  city: "Colombo",
  district: "Colombo",
  postalCode: "00300",
  username: "dushani.n",
  password: "Passw0rd1",
  confirmPassword: "Passw0rd1",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedHash.mockResolvedValue("hashed-password");
  mockedTransaction.mockImplementation((work) =>
    work({} as never)
  );
  mockedInsertUser.mockResolvedValue("user-id");
});

describe("registerAccount", () => {
  it("hashes the password and stores normalised citizen details", async () => {
    const account = await registerAccount("citizen", citizenPayload);

    expect(mockedHash).toHaveBeenCalledWith("Passw0rd1", 12);
    expect(insertUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        full_name: "Dushani Naveendhya",
        email: "dushani@example.com",
        phone_number: "0771234567",
        nic_number: "123456789V",
        role: "CITIZEN",
        status: "ACTIVE",
        password_hash: "hashed-password",
      })
    );
    expect(insertDeliveryVolunteerTeam).not.toHaveBeenCalled();
    expect(insertDeliveryVolunteer).not.toHaveBeenCalled();
    expect(account).toEqual({
      id: expect.any(String),
      fullName: "Dushani Naveendhya",
      email: "dushani@example.com",
      username: "dushani.n",
      role: "CITIZEN",
      status: "ACTIVE",
      verifiedBy: null,
      interfaces: ["MOBILE_APP"],
    });
    expect(JSON.stringify(account)).not.toContain("hashed-password");
  });

  it("rejects an invalid NIC before touching the database", async () => {
    await expect(
      registerAccount("citizen", { ...citizenPayload, nicNumber: "12345" })
    ).rejects.toMatchObject({
      status: 400,
      fieldErrors: {
        nicNumber: "NIC must be 9 digits followed by V or X, or 12 digits.",
      },
    });

    expect(mockedTransaction).not.toHaveBeenCalled();
    expect(mockedHash).not.toHaveBeenCalled();
  });

  it("writes a delivery volunteer team profile next to the leader account", async () => {
    await registerAccount("delivery-volunteer-team", {
      teamName: "Alpha Response Team",
      teamRegistrationNumber: "",
      teamLeaderName: "Kamal Silva",
      teamLeaderContact: "0771234567",
      teamAddress: "No. 5, Lake Road",
      operatingDistrict: "Kandy",
      numberOfMembers: "14",
      teamMemberDetails: "Two drivers, four loaders, eight field helpers.",
      email: "kamal@example.com",
      hasVehicle: "No",
      username: "alpha.team",
      password: "Passw0rd1",
      confirmPassword: "Passw0rd1",
    });

    expect(insertUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        full_name: "Kamal Silva",
        district: "Kandy",
        role: "DELIVERY_VOLUNTEER_TEAM",
      })
    );
    expect(insertDeliveryVolunteerTeam).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        team_name: "Alpha Response Team",
        member_count: 14,
        member_details: "Two drivers, four loaders, eight field helpers.",
        leader_phone_number: "0771234567",
        has_vehicle: false,
        vehicle_type: null,
        driver_name: null,
      })
    );
  });

  it("requires vehicle details when the team answers Yes", async () => {
    await expect(
      registerAccount("delivery-volunteer-team", {
        teamName: "Rapid Movers",
        teamRegistrationNumber: "TEAM-118",
        teamLeaderName: "Ishara Fernando",
        teamLeaderContact: "0712345678",
        teamAddress: "No. 21, Temple Road",
        operatingDistrict: "Galle",
        numberOfMembers: "6",
        teamMemberDetails: "Six regular volunteers.",
        email: "rapid@example.com",
        hasVehicle: "Yes",
        username: "rapid.movers",
        password: "Passw0rd1",
        confirmPassword: "Passw0rd1",
      })
    ).rejects.toMatchObject({
      status: 400,
      fieldErrors: expect.objectContaining({
        vehicleRegistrationNumber: "Vehicle registration number is required.",
        vehicleType: "Vehicle type is required.",
        vehicleCapacity: "Vehicle capacity is required.",
        driverName: "Driver or responsible person is required.",
        drivingLicenseNumber: "Driving license number is required.",
      }),
    });

    await registerAccount("delivery-volunteer-team", {
      teamName: "Rapid Movers",
      teamRegistrationNumber: "TEAM-118",
      teamLeaderName: "Ishara Fernando",
      teamLeaderContact: "0712345678",
      teamAddress: "No. 21, Temple Road",
      operatingDistrict: "Galle",
      numberOfMembers: "6",
      teamMemberDetails: "Six regular volunteers.",
      email: "rapid@example.com",
      hasVehicle: "Yes",
      vehicleRegistrationNumber: "LR 4521",
      vehicleType: "Van",
      vehicleCapacity: "12 boxes / 400 kg",
      driverName: "Ruwan Silva",
      drivingLicenseNumber: "GL-338291",
      username: "rapid.movers",
      password: "Passw0rd1",
      confirmPassword: "Passw0rd1",
    });

    expect(insertDeliveryVolunteerTeam).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        has_vehicle: true,
        vehicle_registration_number: "LR 4521",
        vehicle_type: "Van",
        vehicle_capacity: "12 boxes / 400 kg",
        driver_name: "Ruwan Silva",
        driving_license_number: "GL-338291",
      })
    );
  });

  it("stores delivery volunteer emergency contact and clears vehicle columns when No", async () => {
    await registerAccount("delivery-volunteer", {
      fullName: "Asela Bandara",
      nicNumber: "",
      email: "asela@example.com",
      contactNumber: "0771234567",
      address: "No. 3, Beach Road",
      city: "Negombo",
      district: "Gampaha",
      emergencyContactName: "Sunanda Bandara",
      emergencyContactNumber: "0761122334",
      hasVehicle: "No",
      username: "asela.b",
      password: "Passw0rd1",
      confirmPassword: "Passw0rd1",
    });

    expect(insertUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ role: "DELIVERY_VOLUNTEER", district: "Gampaha" })
    );
    expect(insertDeliveryVolunteer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        emergency_contact_name: "Sunanda Bandara",
        emergency_contact_number: "0761122334",
        has_vehicle: false,
        vehicle_registration_number: null,
        vehicle_type: null,
        vehicle_capacity: null,
        driving_license_number: null,
      })
    );
    expect(insertDeliveryVolunteerTeam).not.toHaveBeenCalled();
  });

  it("rejects an incomplete vehicle section for a delivery volunteer", async () => {
    await expect(
      registerAccount("delivery-volunteer", {
        fullName: "Asela Bandara",
        nicNumber: "",
        email: "asela@example.com",
        contactNumber: "0771234567",
        address: "No. 3, Beach Road",
        city: "Negombo",
        district: "Gampaha",
        emergencyContactName: "Sunanda Bandara",
        emergencyContactNumber: "0761122334",
        hasVehicle: "Yes",
        vehicleType: "Bike",
        username: "asela.b",
        password: "Passw0rd1",
        confirmPassword: "Passw0rd1",
      })
    ).rejects.toMatchObject({
      status: 400,
      fieldErrors: expect.objectContaining({
        vehicleType: "Vehicle type is not a supported option.",
        drivingLicenseNumber: "Driving license number is required.",
      }),
    });
  });

  it("holds relief agencies and DMC officers for verification", async () => {
    await registerAccount("relief-agency", {
      organizationName: "Help Hands",
      organizationType: "NGO",
      registrationNumber: "NGO-881",
      contactPerson: "Nimal Perera",
      contactNumber: "0771234567",
      email: "ops@helphands.org",
      organizationAddress: "No. 9, Bauer Street",
      district: "Colombo",
      operatingArea: "Western Province",
      username: "helphands",
      password: "Passw0rd1",
      confirmPassword: "Passw0rd1",
    });

    expect(insertUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        role: "RELIEF_AGENCY",
        status: "PENDING_VERIFICATION",
        full_name: "Nimal Perera",
      })
    );
    expect(insertReliefAgency).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        agency_name: "Help Hands",
        registration_number: "NGO-881",
      })
    );
    expect(insertOrganizationAdmin).not.toHaveBeenCalled();

    await registerAccount("dmc-officer", {
      fullName: "Sunali Jayasuriya",
      officerId: "DMC-10293",
      designation: "Senior Officer",
      officialEmail: "officer@dmc.gov.lk",
      phoneNumber: "0771234567",
      dmcOffice: "Colombo DMC Office",
      district: "Colombo",
      clearanceInfo: "",
      password: "Passw0rd1",
      confirmPassword: "Passw0rd1",
    });

    expect(insertUser).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        role: "DMC_OFFICER",
        status: "PENDING_VERIFICATION",
        username: "officer",
      })
    );
    expect(insertDmcOfficer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ officer_id: "DMC-10293" })
    );
  });

  it("registers a rescue organization admin that verifies its own teams", async () => {
    const account = await registerAccount("organization-admin", {
      organizationName: "Shield Rescue Force",
      organizationType: "Rescue Organization",
      registrationNumber: "RO-114",
      contactPerson: "Farhan Marikar",
      contactNumber: "0771234567",
      email: "ops@shieldrescue.lk",
      organizationAddress: "No. 44, Residency Road",
      district: "Colombo",
      operatingArea: "Western Province",
      numberOfRescueTeams: "5",
      username: "shield.rescue",
      password: "Passw0rd1",
      confirmPassword: "Passw0rd1",
    });

    expect(insertOrganizationAdmin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organization_name: "Shield Rescue Force",
        organization_type: "Rescue Organization",
        registration_number: "RO-114",
        rescue_team_count: 5,
      })
    );
    expect(insertReliefAgency).not.toHaveBeenCalled();
    expect(account.verifiedBy).toBe("SUPER_ADMIN");
    expect(account.interfaces).toEqual(["DMC_PORTAL"]);
  });

  it("rejects an organization admin without a rescue team count", async () => {
    await expect(
      registerAccount("organization-admin", {
        organizationName: "Shield Rescue Force",
        organizationType: "Rescue Organization",
        registrationNumber: "RO-114",
        contactPerson: "Farhan Marikar",
        contactNumber: "0771234567",
        email: "ops@shieldrescue.lk",
        organizationAddress: "No. 44, Residency Road",
        district: "Colombo",
        operatingArea: "",
        numberOfRescueTeams: "",
        username: "shield.rescue",
        password: "Passw0rd1",
        confirmPassword: "Passw0rd1",
      })
    ).rejects.toMatchObject({
      status: 400,
      fieldErrors: {
        numberOfRescueTeams: "Number of rescue teams is required.",
      },
    });
  });

  it("links an organization team leader to the admin who verifies the team", async () => {
    const account = await registerAccount("organization-team-leader", {
      organizationName: "Shield Rescue Force",
      organizationRegistrationNumber: "RO-114",
      teamName: "Kaduwela Rescue Team",
      leaderFullName: "Kamal Silva",
      nicNumber: "",
      contactNumber: "0771234567",
      email: "kamal@shieldrescue.lk",
      teamAddress: "No. 5, Lake Road",
      operatingDistrict: "Gampaha",
      numberOfMembers: "9",
      teamMemberDetails: "One driver, two loaders, six field helpers.",
      username: "kamal.team",
      password: "Passw0rd1",
      confirmPassword: "Passw0rd1",
    });

    expect(insertUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        full_name: "Kamal Silva",
        district: "Gampaha",
        role: "ORGANIZATION_TEAM_LEADER",
        status: "PENDING_VERIFICATION",
      })
    );
    expect(insertTeamLeader).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        affiliation: "ORGANIZATION",
        verified_by: "ORGANIZATION_ADMIN",
        organization_name: "Shield Rescue Force",
        organization_registration_number: "RO-114",
        team_name: "Kaduwela Rescue Team",
        member_count: 9,
      })
    );
    expect(insertOrganizationAdmin).not.toHaveBeenCalled();
    expect(account.verifiedBy).toBe("ORGANIZATION_ADMIN");
    expect(account.interfaces).toEqual(["MOBILE_APP", "DMC_PORTAL"]);
  });

  it("keeps an independent team leader free of organization details", async () => {
    const account = await registerAccount("independent-team-leader", {
      teamName: "Wellawatte Neighbours",
      leaderFullName: "Amara Jay",
      nicNumber: "103456789012",
      contactNumber: "0712345678",
      email: "amara@example.com",
      teamAddress: "No. 21, Temple Road",
      operatingDistrict: "Colombo",
      numberOfMembers: "4",
      teamMemberDetails: "Four neighbours on the same street.",
      username: "neighbours",
      password: "Passw0rd1",
      confirmPassword: "Passw0rd1",
    });

    expect(insertUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        nic_number: "103456789012",
        role: "INDEPENDENT_TEAM_LEADER",
      })
    );
    expect(insertTeamLeader).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        affiliation: "INDEPENDENT",
        verified_by: "SUPER_ADMIN",
        organization_name: null,
        organization_registration_number: null,
        leader_phone_number: "0712345678",
      })
    );
    expect(account.verifiedBy).toBe("SUPER_ADMIN");
    expect(account.interfaces).toEqual(["MOBILE_APP", "DMC_PORTAL"]);
  });

  it("rejects an unsupported clearance level for a district officer", async () => {
    await expect(
      registerAccount("district-officer", {
        fullName: "Nimali Silva",
        officerId: "DDO-2210",
        officialEmail: "nimali@dmc.gov.lk",
        dutyPhoneNumber: "0771234567",
        assignedDistrict: "Kalutara",
        divisionalSecretariats: "",
        clearanceLevel: "Everything",
        password: "Passw0rd1",
        confirmPassword: "Passw0rd1",
      })
    ).rejects.toMatchObject({
      status: 400,
      fieldErrors: {
        clearanceLevel: "Clearance level is not a supported option.",
      },
    });

    expect(insertDistrictOfficer).not.toHaveBeenCalled();
  });

  it("stores a district officer against the assigned district", async () => {
    const account = await registerAccount("district-officer", {
      fullName: "Nimali Silva",
      officerId: "DDO-2210",
      officialEmail: "nimali@dmc.gov.lk",
      dutyPhoneNumber: "0771234567",
      assignedDistrict: "Kalutara",
      divisionalSecretariats: "Panadura, Beruwala",
      clearanceLevel: "Resource and Logistics",
      password: "Passw0rd1",
      confirmPassword: "Passw0rd1",
    });

    expect(insertUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        role: "DISTRICT_OFFICER",
        district: "Kalutara",
        username: "nimali",
        status: "PENDING_VERIFICATION",
      })
    );
    expect(insertDistrictOfficer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        officer_id: "DDO-2210",
        assigned_district: "Kalutara",
        divisional_secretariats: "Panadura, Beruwala",
        clearance_level: "Resource and Logistics",
        duty_phone_number: "0771234567",
      })
    );
    expect(account.interfaces).toEqual(["DMC_PORTAL"]);
  });

  it("rejects an unsupported registration type with 404", async () => {
    await expect(
      registerAccount("space-force", citizenPayload)
    ).rejects.toBeInstanceOf(ApiError);

    await expect(
      registerAccount("space-force", citizenPayload)
    ).rejects.toMatchObject({ status: 404 });
  });

  it("reports mismatched passwords as a field error", async () => {
    await expect(
      registerAccount("citizen", {
        ...citizenPayload,
        confirmPassword: "Passw0rd2",
      })
    ).rejects.toMatchObject({
      status: 400,
      fieldErrors: { confirmPassword: "Passwords do not match." },
    });
  });
});
