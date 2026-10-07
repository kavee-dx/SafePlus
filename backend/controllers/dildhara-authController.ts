import type { Request, Response } from "express";

import { readStringPayload } from "../validators/registrationValidators";
import { loginAccount } from "../services/dildhara-authService";

export async function login(req: Request, res: Response): Promise<void> {
  const { token, account } = await loginAccount(readStringPayload(req.body));

  res.status(200).json({
    message: "Login successful.",
    token,
    account,
  });
}