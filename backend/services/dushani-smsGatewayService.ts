import { BroadcastStatus, ChannelType } from "../models/disasterWarning";
import { insertAlertSms } from "../repositories/dushani-alertSmsRepository";
import type { NewAlertSms } from "../models/alertSms";
import type {
  AlertRecipient,
  ChannelResult,
  DisseminationChannel,
  DispatchRequest,
} from "./dushani-disseminationChannels";

/** Short-code style sender id printed above the message on the handset. */
export function smsSenderId(): string {
  return process.env.SMS_SENDER_ID?.trim().toUpperCase() || "DMC-ALERT";
}

/**
 * DMC public warning levels, phrased the way the storyboard prints them on the
 * alert card so the phone and the SMS never disagree.
 */
export function alertLevelLabel(severityLevel: string): string {
  const levels: Record<string, string> = {
    LOW: "Level 1 - Be informed",
    MEDIUM: "Level 2 - Be prepared",
    HIGH: "Level 3 - Evacuate soon",
    CRITICAL: "Level 3 - Immediate Evacuation",
  };

  return levels[severityLevel] ?? severityLevel;
}

export function defaultInstruction(severityLevel: string): string {
  return severityLevel === "CRITICAL"
    ? "Move to higher ground now."
    : "Stay alert and follow local DMC instructions.";
}

/** The exact text handed to the SMSC: all three languages plus a reference. */
export function buildSmsBody(request: DispatchRequest): string {
  const { englishText, sinhalaText, tamilText } = request.payload;
  const message = [englishText, sinhalaText, tamilText]
    .map((text) => text.trim())
    .filter(Boolean)
    .join(" | ");

  return `${message} | Ref ${request.warningId} (DMC Sri Lanka)`;
}

async function postSmsc(
  endpoint: string,
  body: Record<string, unknown>
): Promise<number> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`SMSC responded with ${response.status}`);
  }

  const data = (await response.json().catch(() => ({}))) as { accepted?: number };

  return Number(data.accepted ?? 0);
}

/**
 * The SMS channel of UC-01.
 *
 * A text only counts as delivered when the citizen's handset can show it, so
 * this channel hands the message to the SMSC when the deployment has one and
 * stores it per recipient for the app's alert inbox. Without a gateway the
 * store is the delivery, reported as simulated so the audit trail never claims
 * a carrier sweep that did not happen.
 */
export class SmsAlertChannel implements DisseminationChannel {
  readonly channelType = ChannelType.SMS;

  constructor(
    private readonly gatewayUrl = process.env.SMS_GATEWAY_URL,
    private readonly post: (
      endpoint: string,
      body: Record<string, unknown>
    ) => Promise<number> = postSmsc
  ) {}

  async send(request: DispatchRequest): Promise<ChannelResult> {
    const startedAt = Date.now();
    const cohort = request.recipients.filter(
      (recipient): recipient is AlertRecipient & { phoneNumber: string } =>
        Boolean(recipient.phoneNumber)
    );
    const targetCount = cohort.length;

    if (targetCount === 0) {
      return {
        status: BroadcastStatus.FAILED,
        targetCount: 0,
        deliveryCount: 0,
        failureCount: 0,
        elapsedMs: Date.now() - startedAt,
        errorMessage: `No phone numbers are registered in ${request.targetDistrict} District.`,
        simulated: false,
      };
    }

    const levelLabel = alertLevelLabel(request.severityLevel);
    const areaLabel = `${request.targetDistrict} District`;
    const instruction =
      request.safetyInstructions?.trim() || defaultInstruction(request.severityLevel);
    const body = buildSmsBody(request);

    if (this.gatewayUrl) {
      const rejection = await this.handToSmsc(request, cohort, body);

      if (rejection) {
        return {
          status: BroadcastStatus.FAILED,
          targetCount,
          deliveryCount: 0,
          failureCount: targetCount,
          elapsedMs: Date.now() - startedAt,
          errorMessage: rejection,
          simulated: false,
        };
      }
    }

    const delivered = await insertAlertSms(
      cohort.map<NewAlertSms>((recipient) => ({
        warningInternalId: request.warningInternalId,
        recipientId: recipient.userId,
        senderId: smsSenderId(),
        levelLabel,
        areaLabel,
        instruction,
        body,
      }))
    );

    if (delivered === 0) {
      return {
        status: BroadcastStatus.FAILED,
        targetCount,
        deliveryCount: 0,
        failureCount: targetCount,
        elapsedMs: Date.now() - startedAt,
        errorMessage: "None of the queued messages reached a handset.",
        simulated: false,
      };
    }

    return {
      status:
        delivered === targetCount ? BroadcastStatus.SUCCESS : BroadcastStatus.PARTIAL,
      targetCount,
      deliveryCount: delivered,
      failureCount: targetCount - delivered,
      elapsedMs: Date.now() - startedAt,
      simulated: !this.gatewayUrl,
    };
  }

  /** Returns the reason the batch was not fully accepted, if any. */
  private async handToSmsc(
    request: DispatchRequest,
    cohort: (AlertRecipient & { phoneNumber: string })[],
    body: string
  ): Promise<string | undefined> {
    try {
      const accepted = await this.post(this.gatewayUrl!, {
        sender: smsSenderId(),
        destinations: cohort.map((recipient) => recipient.phoneNumber),
        message: body,
        alertId: request.warningId,
      });

      return accepted < cohort.length
        ? `SMSC accepted ${accepted} of ${cohort.length} messages.`
        : undefined;
    } catch (error) {
      return error instanceof Error ? error.message : "SMSC unavailable.";
    }
  }
}
