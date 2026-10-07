jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), connect: jest.fn() },
}));
jest.mock("../services/registrationService");

import request from "supertest";

import app from "../app";
import { registerAccount } from "../services/registrationService";
import { ApiError } from "../utils/apiError";

const mockedRegister = registerAccount as jest.MockedFunction<typeof registerAccount>;

describe("POST /api/registrations/:type", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates a citizen account and returns the public shape", async () => {
    mockedRegister.mockResolvedValue({
      id: "c1",
      fullName: "Dushani Naveendhya",
      email: "dushani@example.com",
      username: "dushani.n",
      role: "CITIZEN",
      status: "ACTIVE",
      verifiedBy: null,
      interfaces: ["MOBILE_APP"],
    });

    const response = await request(app)
      .post("/api/registrations/citizen")
      .send({ fullName: "Dushani Naveendhya", password: "Passw0rd1" });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe(
      "Registration successful. Your account is ready to use."
    );
    expect(response.body.account.username).toBe("dushani.n");
    expect(mockedRegister).toHaveBeenCalledWith("citizen", {
      fullName: "Dushani Naveendhya",
      password: "Passw0rd1",
    });
  });

  it("passes validation failures through as a 400 with field errors", async () => {
    mockedRegister.mockRejectedValue(
      new ApiError(400, "Please correct the highlighted fields and try again.", {
        nicNumber: "NIC must be 9 digits followed by V or X, or 12 digits.",
      })
    );

    const response = await request(app)
      .post("/api/registrations/citizen")
      .send({ nicNumber: "12345" });

    expect(response.status).toBe(400);
    expect(response.body.errors.nicNumber).toContain("12 digits");
  });

  it("tells organization admins their submission is pending verification", async () => {
    mockedRegister.mockResolvedValue({
      id: "a1",
      fullName: "Nimal Perera",
      email: "ops@helphands.org",
      username: "helphands",
      role: "ORGANIZATION_ADMIN",
      status: "PENDING_VERIFICATION",
      verifiedBy: "SUPER_ADMIN",
      interfaces: ["DMC_PORTAL"],
    });

    const response = await request(app)
      .post("/api/registrations/organization-admin")
      .send({ organizationName: "Help Hands" });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Registration submitted for verification.");
    expect(response.body.account.interfaces).toEqual(["DMC_PORTAL"]);
  });

  it("returns 404 for an unknown registration type", async () => {
    mockedRegister.mockRejectedValue(new ApiError(404, "Unknown registration type"));

    const response = await request(app)
      .post("/api/registrations/space-force")
      .send({});

    expect(response.status).toBe(404);
  });

  it("hides unexpected failures behind a generic 500", async () => {
    const logError = jest.spyOn(console, "error").mockImplementation(() => {});
    mockedRegister.mockRejectedValue(new Error("database exploded"));

    const response = await request(app)
      .post("/api/registrations/citizen")
      .send({});

    expect(response.status).toBe(500);
    expect(response.body.message).toBe(
      "Something went wrong. Please try again."
    );
    expect(response.body.message).not.toContain("database exploded");
    logError.mockRestore();
  });

  it("serves the existing health route", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("SafePlus API is healthy");
  });
});
