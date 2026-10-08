import bcrypt from "bcrypt";

import { ApiError } from "../utils/apiError";
import {
  findOfficerByUserId,
  updateOfficerPinHash,
} from "../repositories/dushani-officerRepository";

const BCRYPT_ROUNDS = 12;
const PIN_PATTERN = /^\d{6}$/;

export interface PinStatus {
  isOfficer: boolean;
  hasPin: boolean;
  pinUpdatedAt?: Date;
}

/**
 * Operational clearance PIN (E3).
 *
 * Group 30's design treated the PIN as a shared, hard-coded 4-digit string.
 * Here every DMC officer sets their own 6-digit PIN, only its bcrypt hash is
 * stored, and a failed check is recorded as an unauthorized attempt instead
 * of silently returning a generic error.
 */
export class OfficerPinService {
  async getStatus(userId: string): Promise<PinStatus> {
    const officer = await findOfficerByUserId(userId);

    if (!officer) {
      return { isOfficer: false, hasPin: false };
    }

    return {
      isOfficer: true,
      hasPin: Boolean(officer.pinHash),
      pinUpdatedAt: officer.pinUpdatedAt ?? undefined,
    };
  }

  async setPin(
    userId: string,
    pin: string,
    currentPin?: string
  ): Promise<{ pinUpdatedAt: Date }> {
    this.assertPinFormat(pin);

    const officer = await findOfficerByUserId(userId);

    if (!officer) {
      throw new ApiError(403, "Only DMC officers can hold a clearance PIN.");
    }

    // Changing an existing PIN must prove knowledge of the old one.
    if (officer.pinHash) {
      if (!currentPin) {
        throw new ApiError(
          400,
          "Enter your current PIN to change it.",
          { currentPin: "Required." }
        );
      }

      const matches = await bcrypt.compare(normalize(currentPin), officer.pinHash);

      if (!matches) {
        throw new ApiError(
          401,
          "Your current PIN does not match.",
          { currentPin: "Incorrect PIN." }
        );
      }
    }

    const pinUpdatedAt = await updateOfficerPinHash(
      userId,
      await bcrypt.hash(pin, BCRYPT_ROUNDS)
    );

    return { pinUpdatedAt: pinUpdatedAt ?? new Date() };
  }

  /**
   * Returns the officer's PIN hash, or null when they have never set one.
   */
  async hashFor(userId: string): Promise<string | null> {
    const officer = await findOfficerByUserId(userId);

    return officer?.pinHash ?? null;
  }

  async verify(userId: string, pin: string): Promise<boolean> {
    const hash = await this.hashFor(userId);

    if (!hash) {
      throw new ApiError(
        428,
        "No clearance PIN is set for this officer. Set one before broadcasting."
      );
    }

    if (!PIN_PATTERN.test(normalize(pin))) {
      return false;
    }

    return bcrypt.compare(normalize(pin), hash);
  }

  private assertPinFormat(pin: string): void {
    const value = normalize(pin);

    if (!PIN_PATTERN.test(value)) {
      throw new ApiError(
        400,
        "Clearance PIN must be exactly 6 digits.",
        { pin: "Use 6 digits, 0-9 only." }
      );
    }

    if (isRepeatingOrSequential(value)) {
      throw new ApiError(
        400,
        "That PIN is too easy to guess. Avoid repeats like 111111 or runs like 123456.",
        { pin: "Too guessable." }
      );
    }
  }
}

function normalize(pin: unknown): string {
  return String(pin ?? "").trim();
}

function isRepeatingOrSequential(value: string): boolean {
  const digits = value.split("").map((digit) => Number(digit));
  const allSame = digits.every((digit) => digit === digits[0]);
  const ascending = digits.every(
    (digit, index) => index === 0 || digit === digits[index - 1] + 1
  );
  const descending = digits.every(
    (digit, index) => index === 0 || digit === digits[index - 1] - 1
  );

  return allSame || ascending || descending;
}

let officerPinService: OfficerPinService | null = null;

export function getOfficerPinService(): OfficerPinService {
  if (!officerPinService) {
    officerPinService = new OfficerPinService();
  }

  return officerPinService;
}
