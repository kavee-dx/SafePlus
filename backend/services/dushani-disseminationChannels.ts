import {
  BroadcastStatus,
  ChannelType,
  type DisasterWarning,
} from "../models/disasterWarning";
import { alertLevelLabel } from "./dushani-smsGatewayService";

export interface AlertRecipient {
  userId: string;
  phoneNumber?: string;
  deviceToken?: string;
}

export interface TrilingualPayload {
  englishText: string;
  sinhalaText: string;
  tamilText: string;
}

export interface DispatchRequest {
  /** UUID of the warning row; `warningId` is the public reference. */
  warningInternalId: string;
  warningId: string;
  hazardType: string;
  severityLevel: string;
  targetDistrict: string;
  safetyInstructions?: string;
  payload: TrilingualPayload;
  recipients: AlertRecipient[];
}

export interface ChannelResult {
  status: BroadcastStatus;
  targetCount: number;
  deliveryCount: number;
  failureCount: number;
  elapsedMs: number;
  errorMessage?: string;
  /** True when no real gateway is configured and the cohort was not really reached. */
  simulated: boolean;
}

export interface DisseminationChannel {
  readonly channelType: ChannelType;
  send(request: DispatchRequest): Promise<ChannelResult>;
}

export interface DispatchOutcome {
  results: Map<ChannelType, ChannelResult>;
  smsFallbackTriggered: boolean;
  pushReceiptRatio: number;
}

/** Group 30 E1: below 40% push receipts inside the window, fall back to SMS. */
export const PUSH_RECEIPT_THRESHOLD = 0.4;
export const DEFAULT_RECEIPT_WINDOW_MS = 15_000;

async function postGateway(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ accepted: number }> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Gateway responded with ${response.status}`);
  }

  const data = (await response.json().catch(() => ({}))) as { accepted?: number };

  return { accepted: Number(data.accepted ?? 0) };
}

function buildMessage(request: DispatchRequest): string {
  const { payload } = request;

  return [payload.englishText, payload.sinhalaText, payload.tamilText]
    .filter(Boolean)
    .join(" | ");
}

/**
 * Shared outcome shape: a gateway that accepted nothing is a failed channel,
 * a gateway that accepted part of the batch is partial, and a deployment
 * without any gateway at all is reported as simulated rather than green.
 */
function channelOutcome(args: {
  targetCount: number;
  accepted: number;
  startedAt: number;
  notes?: string[];
  simulated?: boolean;
}): ChannelResult {
  const { targetCount, accepted, startedAt, simulated = false } = args;
  const notes = (args.notes ?? []).filter(Boolean);
  const elapsedMs = Date.now() - startedAt;
  const detail = notes.slice(0, 3).join("; ") || undefined;

  if (simulated) {
    return {
      status: BroadcastStatus.SUCCESS,
      targetCount,
      deliveryCount: targetCount,
      failureCount: 0,
      elapsedMs,
      errorMessage: detail,
      simulated: true,
    };
  }

  const delivered = Math.min(accepted, targetCount);

  if (delivered === 0) {
    return {
      status: BroadcastStatus.FAILED,
      targetCount,
      deliveryCount: 0,
      failureCount: targetCount,
      elapsedMs,
      errorMessage: detail ?? "Gateway accepted none of the queued deliveries.",
      simulated: false,
    };
  }

  return {
    status:
      delivered === targetCount ? BroadcastStatus.SUCCESS : BroadcastStatus.PARTIAL,
    targetCount,
    deliveryCount: delivered,
    failureCount: targetCount - delivered,
    elapsedMs,
    errorMessage: detail,
    simulated: false,
  };
}

function channelCrash(
  request: DispatchRequest,
  startedAt: number,
  error: unknown,
  label: string
): ChannelResult {
  const targetCount = request.recipients.length;

  return {
    status: BroadcastStatus.FAILED,
    targetCount,
    deliveryCount: 0,
    failureCount: targetCount,
    elapsedMs: Date.now() - startedAt,
    errorMessage: error instanceof Error ? error.message : `${label} unavailable`,
    simulated: false,
  };
}

/**
 * Siren relay: one activation call per district. Every adapter converts its own
 * failure into a ChannelResult instead of throwing, so a dead relay can never
 * abort the push that saves lives.
 */
export class SirenRelayAdapter implements DisseminationChannel {
  readonly channelType = ChannelType.SIREN;

  constructor(private readonly endpoint = process.env.SIREN_RELAY_URL) {}

  async send(request: DispatchRequest): Promise<ChannelResult> {
    const startedAt = Date.now();
    const targetCount = request.recipients.length;

    if (!this.endpoint) {
      return channelOutcome({
        targetCount,
        accepted: targetCount,
        startedAt,
        notes: [
          "Simulated: no siren relay is configured (SIREN_RELAY_URL), so no station sounded.",
        ],
        simulated: true,
      });
    }

    try {
      const outcome = await postGateway(this.endpoint, {
        stations: request.targetDistrict,
        hazardType: request.hazardType,
        severityLevel: request.severityLevel,
        alertId: request.warningId,
      });

      return channelOutcome({ targetCount, accepted: outcome.accepted, startedAt });
    } catch (error) {
      return channelCrash(request, startedAt, error, "Siren relay");
    }
  }
}

/**
 * Push reaches the handset through Expo's push service, which needs no
 * credentials of its own - the citizen app registers an Expo push token when
 * the user allows notifications. `PUSH_GATEWAY_URL` overrides it for
 * deployments that front their own FCM/APNs bridge.
 */
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_BATCH_LIMIT = 100;
const EXPO_TOKEN_SHAPE = /^(ExponentPushToken|ExpoPushToken)\[/;

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "default" | "high";
  channelId: string;
  data: Record<string, string>;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  message?: string;
}

function isExpoPushToken(token: string | undefined): boolean {
  if (!token) {
    return false;
  }

  return EXPO_TOKEN_SHAPE.test(token.replace(/^[{"']+/, ""));
}

async function postExpoPush(
  messages: ExpoPushMessage[]
): Promise<{ accepted: number; errors: string[] }> {
  let accepted = 0;
  const errors: string[] = [];

  for (let index = 0; index < messages.length; index += EXPO_PUSH_BATCH_LIMIT) {
    const batch = messages.slice(index, index + EXPO_PUSH_BATCH_LIMIT);
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      throw new Error(`Expo push service responded with ${response.status}`);
    }

    const parsed = (await response.json()) as {
      data?: ExpoPushTicket[];
      errors?: { message?: string }[];
    };

    if (parsed.errors?.length) {
      errors.push(...parsed.errors.map((item) => item.message ?? "Push rejected."));
    }

    for (const ticket of parsed.data ?? []) {
      if (ticket.status === "ok") {
        accepted += 1;
      } else if (ticket.message) {
        errors.push(ticket.message);
      }
    }
  }

  return { accepted, errors };
}

function pushMessage(
  request: DispatchRequest,
  token: string
): ExpoPushMessage {
  const critical =
    request.severityLevel === "CRITICAL" || request.severityLevel === "HIGH";

  const message = buildMessage(request);

  return {
    to: token,
    title: `DMC alert - ${alertLevelLabel(request.severityLevel)}`,
    body: message,
    sound: "default",
    priority: critical ? "high" : "default",
    channelId: "dmc-alerts",
    data: {
      warningId: request.warningId,
      hazardType: request.hazardType,
      severityLevel: request.severityLevel,
      targetDistrict: request.targetDistrict,
      englishMessage: request.payload.englishText,
      sinhalaMessage: request.payload.sinhalaText,
      tamilMessage: request.payload.tamilText,
      safetyInstructions: request.safetyInstructions || "",
    },
  };
}

export class PushAlertChannel implements DisseminationChannel {
  readonly channelType = ChannelType.PUSH;

  constructor(private readonly endpoint = process.env.PUSH_GATEWAY_URL) {}

  async send(request: DispatchRequest): Promise<ChannelResult> {
    const startedAt = Date.now();
    const cohort = request.recipients.filter((recipient) =>
      Boolean(recipient.deviceToken)
    );
    const targetCount = cohort.length;

    if (targetCount === 0) {
      return {
        status: BroadcastStatus.SKIPPED,
        targetCount: 0,
        deliveryCount: 0,
        failureCount: 0,
        elapsedMs: Date.now() - startedAt,
        errorMessage: `No phone in ${request.targetDistrict} District has notifications enabled, so no push notification was sent.`,
        simulated: false,
      };
    }

    const message = buildMessage(request);

    try {
      if (this.endpoint) {
        const outcome = await postGateway(this.endpoint, {
          destinations: cohort.map((recipient) => recipient.deviceToken),
          message,
          alertId: request.warningId,
        });

        return channelOutcome({
          targetCount,
          accepted: outcome.accepted,
          startedAt,
        });
      }

      const reachable = cohort.filter((recipient) =>
        isExpoPushToken(recipient.deviceToken)
      );

      if (reachable.length === 0) {
        return {
          status: BroadcastStatus.FAILED,
          targetCount,
          deliveryCount: 0,
          failureCount: targetCount,
          elapsedMs: Date.now() - startedAt,
          errorMessage:
            "Stored device tokens are not Expo push tokens. Set PUSH_GATEWAY_URL for a different provider.",
          simulated: false,
        };
      }

      const { accepted, errors } = await postExpoPush(
        reachable.map((recipient) =>
          pushMessage(request, recipient.deviceToken as string)
        )
      );

      return channelOutcome({
        targetCount,
        accepted,
        startedAt,
        notes: errors,
      });
    } catch (error) {
      return channelCrash(request, startedAt, error, "Push gateway");
    }
  }
}

/**
 * Runs the selected channels concurrently and applies the E1 fallback rule.
 */
export class ChannelDispatcher {
  private readonly channels = new Map<ChannelType, DisseminationChannel>();

  constructor(private readonly receiptWindowMs = DEFAULT_RECEIPT_WINDOW_MS) {}

  registerChannel(channel: DisseminationChannel): void {
    this.channels.set(channel.channelType, channel);
  }

  async dispatch(
    warning: DisasterWarning,
    selected: ChannelType[],
    recipients: AlertRecipient[]
  ): Promise<DispatchOutcome> {
    const request: DispatchRequest = {
      warningInternalId: warning.id,
      warningId: warning.warningId,
      hazardType: warning.hazardType,
      severityLevel: warning.severityLevel,
      targetDistrict: warning.targetDistrict,
      safetyInstructions: warning.safetyInstructions,
      payload: {
        englishText: warning.englishMessage,
        sinhalaText: warning.sinhalaMessage,
        tamilText: warning.tamilMessage,
      },
      recipients,
    };

    const results = new Map<ChannelType, ChannelResult>();
    const settled = await Promise.all(
      selected.map(async (channelType) => {
        const channel = this.channels.get(channelType);

        if (!channel) {
          return [
            channelType,
            {
              status: BroadcastStatus.FAILED,
              targetCount: recipients.length,
              deliveryCount: 0,
              failureCount: recipients.length,
              elapsedMs: 0,
              errorMessage: `Channel ${channelType} is not registered.`,
              simulated: false,
            } satisfies ChannelResult,
          ] as const;
        }

        return [
          channelType,
          await withDeadline(channel, request, this.receiptWindowMs),
        ] as const;
      })
    );

    for (const [channelType, result] of settled) {
      results.set(channelType, result);
    }

    const push = results.get(ChannelType.PUSH);
    const pushReceiptRatio =
      push && push.targetCount > 0 ? push.deliveryCount / push.targetCount : 1;

    const smsCapable = recipients.filter((recipient) =>
      Boolean(recipient.phoneNumber)
    ).length;

    const needsFallback =
      Boolean(push) &&
      pushReceiptRatio < PUSH_RECEIPT_THRESHOLD &&
      !selected.includes(ChannelType.SMS) &&
      smsCapable > 0;

    let smsFallbackTriggered = false;

    if (needsFallback) {
      const sms = this.channels.get(ChannelType.SMS);

      if (sms) {
        results.set(ChannelType.SMS, await withDeadline(sms, request, this.receiptWindowMs));
        smsFallbackTriggered = true;
      }
    }

    return { results, smsFallbackTriggered, pushReceiptRatio };
  }
}

/**
 * A hung relay must not hold the broadcast open, so each channel gets its own
 * deadline and a timeout is recorded as that channel's failure.
 */
async function withDeadline(
  channel: DisseminationChannel,
  request: DispatchRequest,
  windowMs: number
): Promise<ChannelResult> {
  let timer: NodeJS.Timeout | undefined;

  const deadline = new Promise<ChannelResult>((resolve) => {
    timer = setTimeout(() => {
      resolve({
        status: BroadcastStatus.FAILED,
        targetCount: request.recipients.length,
        deliveryCount: 0,
        failureCount: request.recipients.length,
        elapsedMs: windowMs,
        errorMessage: `No delivery receipts within ${Math.round(windowMs / 1000)}s.`,
        simulated: false,
      });
    }, windowMs);
  });

  try {
    return await Promise.race([channel.send(request), deadline]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
