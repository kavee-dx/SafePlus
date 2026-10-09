import type { DispatchRoll } from "../models/kaveesha-rescueDispatch";
import {
  clearLeaderPushToken,
  findLeaderPushTarget,
} from "../repositories/kaveesha-dispatchRepository";

/* ------------------------------------------------------------------ *
 * Telling a team leader, on their phone, that they have been tasked.
 *
 * A leader in a boat does not have a laptop open, so the tasking has to reach
 * the handset. The citizen app already registers the phone's Expo push token on
 * sign-in (that is UC-01's `users.device_token`), so this only has to read it
 * and hand the message to Expo's gateway — no new table, no new dependency.
 *
 * Nothing here may fail a dispatch. A tasking that is committed but never
 * announced is a bug to fix in the notification layer, not a reason to refuse
 * the officer's decision, so every path is fire-and-forget and logged.
 * ------------------------------------------------------------------ */

const GATEWAY_URL =
  process.env.EXPO_PUSH_URL?.trim() || "https://exp.host/--/api/v2/push/send";

/** A gateway that hangs must not hold a request open. */
const GATEWAY_TIMEOUT_MS = 8000;

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  /** Keys the app reads to decide which screen to open when the tap lands. */
  data: Record<string, unknown>;
}

export type PushOutcome =
  | "sent"
  | "no-token"
  | "disabled"
  | "no-team"
  | "rejected"
  | "error";

function pushEnabled(): boolean {
  return process.env.DISPATCH_PUSH_ENABLED?.trim().toLowerCase() !== "false";
}

/**
 * Post to the gateway and report what it thought.
 *
 * Expo accepts the HTTP request even when every message inside is rejected, so
 * the per-ticket response is the only honest answer about delivery. A
 * DeviceNotRegistered is acted on: the stale token is dropped, because leaving
 * it means every future tasking to that handset is silently lost.
 */
async function postToGateway(
  messages: ExpoPushMessage[],
  ownerIds: string[]
): Promise<PushOutcome> {
  if (messages.length === 0) return "no-token";

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      acceptance: "application/json",
    },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
  });

  if (!response.ok) {
    console.warn(
      `[dispatch-push] gateway returned ${response.status}; notification skipped`
    );

    return "error";
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: { status: string; message?: string; details?: unknown }[];
  } | null;

  const tickets = payload?.data ?? [];
  let dead = 0;

  for (const [index, ticket] of tickets.entries()) {
    if (ticket.status === "ok") continue;

    dead += 1;
    console.warn(
      `[dispatch-push] ${ticket.status}: ${ticket.message ?? "unknown"} for ${messages[index]?.to.slice(0, 24)}…`
    );

    // The handset no longer belongs to this installation.
    if (ticket.message === "DeviceNotRegistered") {
      const owner = ownerIds[index];

      if (owner) await clearLeaderPushToken(owner).catch(() => undefined);
    }
  }

  if (dead === 0 && tickets.length > 0) return "sent";

  return dead === tickets.length ? "rejected" : "sent";
}

async function deliver(
  teamId: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<PushOutcome> {
  if (!pushEnabled()) return "disabled";

  const target = await findLeaderPushTarget(teamId).catch(() => null);

  if (!target) return "no-team";

  if (!target.deviceToken) {
    console.log(
      `[dispatch-push] no token on file for ${target.fullName}; the board still shows the tasking`
    );

    return "no-token";
  }

  const messages: ExpoPushMessage[] = [
    {
      to: target.deviceToken,
      title,
      body,
      sound: "default",
      priority: "high",
      data,
    },
  ];

  try {
    return await postToGateway(messages, [target.userId]);
  } catch (error) {
    console.warn(
      `[dispatch-push] ${(error as Error).message}; notification skipped`
    );

    return "error";
  }
}

/**
 * A new mission. This is the one notification that must arrive fast, so the
 * wording leads with the reference the control room is reading out over the
 * phone and the hazard the team is driving into.
 */
export async function notifyLeaderOfTasking(
  roll: DispatchRoll
): Promise<PushOutcome> {
  const severity = roll.severityLevel.toLowerCase().replace(/_/g, " ");

  return deliver(
    roll.teamId,
    `You have been tasked · ${roll.dispatchCode}`,
    `${severity} ${roll.hazardType.toLowerCase().replace(/_/g, " ")} at ${
      roll.landmark ?? roll.reportPublicId
    }. Open the app to accept.`,
    {
      screen: "mission",
      dispatchCode: roll.dispatchCode,
      reportId: roll.reportPublicId,
      status: roll.status,
    }
  );
}

/** The officer ended the mission, so the team can turn around. */
export async function notifyLeaderOfStandDown(
  roll: DispatchRoll,
  reason?: string
): Promise<PushOutcome> {
  return deliver(
    roll.teamId,
    `Mission stood down · ${roll.dispatchCode}`,
    reason?.trim()
      ? reason.trim()
      : `${roll.reportPublicId} no longer needs your team. You are released.`,
    {
      screen: "mission",
      dispatchCode: roll.dispatchCode,
      reportId: roll.reportPublicId,
      status: roll.status,
    }
  );
}
