import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { ApiError } from "../utils/apiError";
import {
  INTERFACE_LABELS,
  ROLE_INTERFACES,
  type InterfaceAccess,
  type UserRole,
} from "../models/registration";
import { findUserByEmail } from "../repositories/dildhara-authRepository";
import { validatePayload } from "../validators/registrationValidators";
import { loginRules } from "../validators/dildhara-loginValidators";

const BCRYPT_ROUNDS = 12; // keep equal to registrationService

export interface LoginAccount {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  role: string;
  status: string;
  interfaces: readonly InterfaceAccess[];
}

export interface LoginResult {
  token: string;
  account: LoginAccount;
}

export interface UserTokenPayload {
  sub: string;
  role: string;
  interfaces: readonly InterfaceAccess[];
  type: "user"; // keeps user tokens distinct from admin tokens
}

const STATUS_MESSAGES: Record<string, string> = {
  PENDING_VERIFICATION:
    "Your account is awaiting verification. You can sign in once it is approved.",
  REJECTED: "Your registration was not approved. Please contact support.",
  SUSPENDED: "Your account has been suspended. Please contact support.",
};

let dummyHash: string | null = null;

// Used when the email doesn't exist, so bcrypt still does the same work.
function getDummyHash(): string {
  if (!dummyHash) {
    dummyHash = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);
  }
  return dummyHash;
}

// Read at call time (not import time) because dotenv.config() runs after imports.
function getSecret(): string {
  const secret = process.env.JWT_USER_SECRET;

  if (!secret) {
    throw new Error("JWT_USER_SECRET is not set.");
  }

  return secret;
}

function signUserToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, getSecret(), {
    algorithm: "HS256",
    expiresIn: (process.env.JWT_USER_EXPIRES_IN ||
      "8h") as jwt.SignOptions["expiresIn"],
  });
}

// Counterpart of signUserToken: used by the requireAuth middleware.
// Rejects any token whose `type` is not "user", so admin tokens can't pass.
export function verifyUserToken(token: string): UserTokenPayload {
  const secret = getSecret();

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });

    if (typeof decoded === "string" || decoded.type !== "user") {
      throw new ApiError(401, "Invalid session. Please sign in again.");
    }

    return decoded as unknown as UserTokenPayload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "Session expired. Please sign in again.");
  }
}

export async function loginAccount(
  payload: Record<string, string>
): Promise<LoginResult> {
  const fieldErrors = validatePayload(payload, loginRules);

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError(
      400,
      "Please correct the highlighted fields and try again.",
      fieldErrors
    );
  }

  const email = payload.email.trim().toLowerCase();
  const target = payload.interface.trim() as InterfaceAccess;

  const user = await findUserByEmail(email);

  const passwordMatches = await bcrypt.compare(
    payload.password,
    user?.password_hash ?? getDummyHash()
  );

  if (!user || !passwordMatches) {
    throw new ApiError(401, "Invalid email or password.");
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(
      403,
      STATUS_MESSAGES[user.status] ?? "Your account cannot sign in right now."
    );
  }

  const interfaces = ROLE_INTERFACES[user.role as UserRole];

  if (!interfaces || !interfaces.includes(target)) {
    throw new ApiError(
      403,
      `This account cannot sign in to the ${INTERFACE_LABELS[target]}.`
    );
  }

  const token = signUserToken({
    sub: user.id,
    role: user.role,
    interfaces,
    type: "user",
  });

  return {
    token,
    account: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      interfaces,
    },
  };
}