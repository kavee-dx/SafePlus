import { randomUUID } from "node:crypto";

import bcrypt from "bcrypt";

import { ApiError } from "../utils/apiError";
import {
  REGISTRATION_TYPES,
  type InterfaceAccess,
  type RegistrationPayload,
  type RegistrationTypeDefinition,
} from "../models/registration";
import { validatePayload } from "../validators/registrationValidators";
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

const BCRYPT_ROUNDS = 12;

export interface RegisteredAccount {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  role: string;
  status: string;
  verifiedBy: string | null;
  interfaces: readonly InterfaceAccess[];
}

export function findRegistrationType(
  type: string
): RegistrationTypeDefinition {
  const definition = REGISTRATION_TYPES[type];

  if (!definition) {
    throw new ApiError(
      404,
      `Unknown registration type "${type}". Expected one of: ${Object.keys(
        REGISTRATION_TYPES
      ).join(", ")}.`
    );
  }

  return definition;
}

export async function registerAccount(
  type: string,
  payload: RegistrationPayload
): Promise<RegisteredAccount> {
  const definition = findRegistrationType(type);

  const fieldErrors = validatePayload(payload, definition.validators);

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError(
      400,
      "Please correct the highlighted fields and try again.",
      fieldErrors
    );
  }

  const passwordHash = await bcrypt.hash(payload.password, BCRYPT_ROUNDS);
  const userId = randomUUID();
  const user = { id: userId, ...definition.toUser(payload, passwordHash) };

  await withTransaction(async (client) => {
    await insertUser(client, user);

    if (definition.toDeliveryVolunteer) {
      await insertDeliveryVolunteer(
        client,
        definition.toDeliveryVolunteer(userId, payload)
      );
    }

    if (definition.toDeliveryVolunteerTeam) {
      await insertDeliveryVolunteerTeam(
        client,
        definition.toDeliveryVolunteerTeam(userId, payload)
      );
    }

    if (definition.toReliefAgency) {
      await insertReliefAgency(client, definition.toReliefAgency(userId, payload));
    }

    if (definition.toOrganizationAdmin) {
      await insertOrganizationAdmin(
        client,
        definition.toOrganizationAdmin(userId, payload)
      );
    }

    if (definition.toTeamLeader) {
      await insertTeamLeader(client, definition.toTeamLeader(userId, payload));
    }

    if (definition.toDistrictOfficer) {
      await insertDistrictOfficer(
        client,
        definition.toDistrictOfficer(userId, payload)
      );
    }

    if (definition.toDmcOfficer) {
      await insertDmcOfficer(client, definition.toDmcOfficer(userId, payload));
    }
  });

  return {
    id: userId,
    fullName: user.full_name,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status,
    verifiedBy: definition.verifiedBy,
    interfaces: definition.interfaces,
  };
}
