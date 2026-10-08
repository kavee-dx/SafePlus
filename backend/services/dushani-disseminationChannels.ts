import {
  BroadcastStatus,
  ChannelType,
  type DisasterWarning,
} from "../models/disasterWarning";

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
  warningId: string;
  hazardType: string;
  severityLevel: string;
  targetDistrict: string;
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

type Transport = (payload: Record<string, unknown>) => Promise<{ accepted: number }>;

interface ChannelOptions {
  endpoint?: string;
  transport?: Transport;
  kind: "push" | "sms" | "siren";
}

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
 * One channel per delivery mechanism. Every adapter converts its own failure
 * into a ChannelResult instead of throwing, so a dead siren relay can never
 * abort the push that saves lives.
 */
class GatewayChannel implements DisseminationChannel {
  constructor(
    readonly channelType: ChannelType,
    private readonly options: ChannelOptions
  ) {}

  async send(request: DispatchRequest): Promise<ChannelResult> {
    const startedAt = Date.now();
    const cohort = this.cohort(request);
    const targetCount = cohort.length;

    if (targetCount === 0) {
      return {
        status: BroadcastStatus.FAILED,
        targetCount: 0,
        deliveryCount: 0,
        failureCount: 0,
        elapsedMs: Date.now() - startedAt,
        errorMessage: `No ${this.options.kind} targets in ${request.targetDistrict} District.`,
        simulated: false,
      };
    }

    try {
      const outcome = await this.deliver(request, cohort);

      if (outcome.simulated) {
        return {
          status: BroadcastStatus.SUCCESS,
          targetCount,
          deliveryCount: targetCount,
          failureCount: 0,
          elapsedMs: Date.now() - startedAt,
          simulated: true,
        };
      }

      const delivered = Math.min(outcome.accepted, targetCount);

      if (delivered === 0) {
        return {
          status: BroadcastStatus.FAILED,
          targetCount,
          deliveryCount: 0,
          failureCount: targetCount,
          elapsedMs: Date.now() - startedAt,
          errorMessage: "Gateway accepted none of the queued deliveries.",
          simulated: false,
        };
      }

      return {
        status:
          delivered === targetCount
            ? BroadcastStatus.SUCCESS
            : BroadcastStatus.PARTIAL,
        targetCount,
        deliveryCount: delivered,
        failureCount: targetCount - delivered,
        elapsedMs: Date.now() - startedAt,
        simulated: false,
      };
    } catch (error) {
      return {
        status: BroadcastStatus.FAILED,
        targetCount,
        deliveryCount: 0,
        failureCount: targetCount,
        elapsedMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : "Channel unavailable",
        simulated: false,
      };
    }
  }

  private cohort(request: DispatchRequest): AlertRecipient[] {
    if (this.channelType === ChannelType.PUSH) {
      return request.recipients.filter((recipient) => Boolean(recipient.deviceToken));
    }

    if (this.channelType === ChannelType.SMS) {
      return request.recipients.filter((recipient) => Boolean(recipient.phoneNumber));
    }

    return request.recipients;
  }

  private async deliver(
    request: DispatchRequest,
    cohort: AlertRecipient[]
  ): Promise<{ accepted: number; simulated: boolean }> {
    const message = buildMessage(request);

    const body =
      this.channelType === ChannelType.SIREN
        ? {
            stations: request.targetDistrict,
            hazardType: request.hazardType,
            severityLevel: request.severityLevel,
            alertId: request.warningId,
          }
        : {
            destinations:
              this.channelType === ChannelType.PUSH
                ? cohort.map((recipient) => recipient.deviceToken)
                : cohort.map((recipient) => recipient.phoneNumber),
            message,
            alertId: request.warningId,
          };

    if (this.options.transport) {
      const outcome = await this.options.transport(body);

      return { accepted: outcome.accepted, simulated: false };
    }

    const endpoint = this.options.endpoint;

    if (!endpoint) {
      // Nothing is wired up in this environment: report a simulated sweep so the
      // officer sees the flow without the audit trail pretending to be real.
      return { accepted: cohort.length, simulated: true };
    }

    const outcome = await postGateway(endpoint, body);

    return { accepted: outcome.accepted, simulated: false };
  }
}

export class PushNotificationAdapter extends GatewayChannel {
  constructor(endpoint = process.env.PUSH_GATEWAY_URL, transport?: Transport) {
    super(ChannelType.PUSH, { kind: "push", endpoint, transport });
  }
}

export class SMSFallbackAdapter extends GatewayChannel {
  constructor(endpoint = process.env.SMSC_ADDRESS, transport?: Transport) {
    super(ChannelType.SMS, { kind: "sms", endpoint, transport });
  }
}

export class SirenRelayAdapter extends GatewayChannel {
  constructor(endpoint = process.env.SIREN_RELAY_URL, transport?: Transport) {
    super(ChannelType.SIREN, { kind: "siren", endpoint, transport });
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
      warningId: warning.warningId,
      hazardType: warning.hazardType,
      severityLevel: warning.severityLevel,
      targetDistrict: warning.targetDistrict,
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

export function createDefaultDispatcher(): ChannelDispatcher {
  const dispatcher = new ChannelDispatcher();

  dispatcher.registerChannel(new PushNotificationAdapter());
  dispatcher.registerChannel(new SMSFallbackAdapter());
  dispatcher.registerChannel(new SirenRelayAdapter());

  return dispatcher;
}
