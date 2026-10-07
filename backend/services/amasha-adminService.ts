import { ApiError } from "../utils/apiError";
import {
  countRegistrationsByStatus,
  findRegistrationById,
  listRegistrationsForReview,
  setUserStatus,
  type ListFilters,
  type RegistrationRecord,
} from "../repositories/amasha-adminRepository";
import { sendVerificationResultEmail } from "./amasha-emailService";

export async function listRegistrations(
  filters: ListFilters
): Promise<RegistrationRecord[]> {
  return listRegistrationsForReview(filters);
}

export async function getRegistration(
  id: string
): Promise<RegistrationRecord> {
  const record = await findRegistrationById(id);

  if (!record) {
    throw new ApiError(404, "Registration not found.");
  }

  return record;
}

export async function getStats(): Promise<{
  pending: number;
  active: number;
  rejected: number;
  suspended: number;
  total: number;
}> {
  const counts = await countRegistrationsByStatus();
  const total =
    counts.PENDING_VERIFICATION +
    counts.ACTIVE +
    counts.REJECTED +
    counts.SUSPENDED;

  return {
    pending: counts.PENDING_VERIFICATION,
    active: counts.ACTIVE,
    rejected: counts.REJECTED,
    suspended: counts.SUSPENDED,
    total,
  };
}

export async function approveRegistration(
  id: string,
  adminId: string
): Promise<RegistrationRecord> {
  const record = await getRegistration(id);

  if (record.status === "ACTIVE") {
    throw new ApiError(409, "This registration is already approved.");
  }

  await setUserStatus(id, "ACTIVE", {
    rejectionReason: null,
    adminId,
  });

  await sendVerificationResultEmail({
    to: record.email,
    fullName: record.fullName,
    role: record.role,
    approved: true,
  });

  return getRegistration(id);
}

export async function rejectRegistration(
  id: string,
  reason: string,
  adminId: string
): Promise<RegistrationRecord> {
  const trimmedReason = String(reason || "").trim();

  if (trimmedReason.length < 5) {
    throw new ApiError(
      400,
      "Please provide a rejection reason (at least 5 characters)."
    );
  }

  const record = await getRegistration(id);

  if (record.status === "REJECTED") {
    throw new ApiError(409, "This registration is already rejected.");
  }

  await setUserStatus(id, "REJECTED", {
    rejectionReason: trimmedReason,
    adminId,
  });

  await sendVerificationResultEmail({
    to: record.email,
    fullName: record.fullName,
    role: record.role,
    approved: false,
    reason: trimmedReason,
  });

  return getRegistration(id);
}
