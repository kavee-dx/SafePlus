import type { Request, Response } from "express";

import { readStringPayload } from "../validators/registrationValidators";
import { registerAccount } from "../services/registrationService";

export async function createRegistration(
  req: Request,
  res: Response
): Promise<void> {
  const type = String(req.params.type);
  const account = await registerAccount(type, readStringPayload(req.body));

  res.status(201).json({
    message:
      account.status === "PENDING_VERIFICATION"
        ? "Registration submitted for verification."
        : "Registration successful. Your account is ready to use.",
    registrationType: type,
    account,
  });
}
