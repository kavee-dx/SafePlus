import express from "express";
import request from "supertest";

let mockRole: string | null = "COORDINATOR";

jest.mock("../middlewares/dildhara-requireAuth", () => ({
  requireAuth: (req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) => {
    if (mockRole) {
      req.user = {
        sub: "33333333-3333-4333-8333-333333333333",
        role: mockRole,
      };
    }
    next();
  },
}));

import allocationRoutes from "../routes/dildhara-reliefAllocationRoutes";
import dispatchRoutes from "../routes/dildhara-reliefDispatchRoutes";

const app = express();
app.use(express.json());
app.use("/api/relief-operations/allocations", allocationRoutes);
app.use("/api/relief-operations/dispatches", dispatchRoutes);
app.use((error: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(error.status ?? 500).json({ message: error.message ?? "Unexpected error." });
});

describe("relief operations routes", () => {
  beforeEach(() => {
    mockRole = "COORDINATOR";
  });

  it("exposes protected coordinator resource and dispatch registers", async () => {
    const resources = await request(app)
      .get("/api/relief-operations/allocations/resources/available")
      .expect(200);
    const dispatches = await request(app)
      .get("/api/relief-operations/dispatches")
      .expect(200);

    expect(resources.body).toEqual({ resources: [] });
    expect(dispatches.body).toEqual({ dispatches: [] });
  });

  it("rejects authenticated users without coordinator role", async () => {
    mockRole = "CITIZEN";

    await request(app)
      .get("/api/relief-operations/dispatches")
      .expect(403);
  });

  it("rejects requests when authentication supplies no user", async () => {
    mockRole = null;

    await request(app)
      .get("/api/relief-operations/allocations")
      .expect(401);
  });
});
