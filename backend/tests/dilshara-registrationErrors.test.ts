import type { NextFunction, Request, Response } from "express";

import { errorHandler } from "../middlewares/errorHandler";

function handleUniqueError(error: Error & {
  code: string;
  constraint?: string;
  detail?: string;
}) {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  errorHandler(
    error,
    {
      originalUrl: "/api/registrations/delivery-volunteer",
    } as Request,
    response as unknown as Response,
    jest.fn() as NextFunction
  );

  return response;
}

describe("duplicate registration errors", () => {
  it.each([
    [
      "users_email_key",
      "Key (email)=(private@example.com) already exists.",
      "email",
      "That email address is already registered. Please use a different one.",
    ],
    [
      "users_username_key",
      "Key (username)=(private) already exists.",
      "username",
      "That username is already registered. Please use a different one.",
    ],
  ])("returns a clear field error for %s", (constraint, detail, field, message) => {
    const error = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint,
      detail,
    });
    const response = handleUniqueError(error);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      message,
      errors: { [field]: "Already in use by another account." },
    });
  });

  it("uses PostgreSQL's key detail when its constraint name is unavailable", () => {
    const error = Object.assign(new Error("duplicate key"), {
      code: "23505",
      detail: "Key (email)=(private@example.com) already exists.",
    });
    const response = handleUniqueError(error);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      message:
        "That email address is already registered. Please use a different one.",
      errors: { email: "Already in use by another account." },
    });
  });

  it("preserves the existing conflict response for other registration roles", () => {
    const error = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint: "users_email_key",
      detail: "Key (email)=(private@example.com) already exists.",
    });
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    errorHandler(
      error,
      { originalUrl: "/api/registrations/citizen" } as Request,
      response as unknown as Response,
      jest.fn() as NextFunction
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      message: "Record already exists.",
    });
  });
});
