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

/** The trilingual text kept for the app's alert inbox. */
export function buildSmsBody(request: DispatchRequest): string {
  const { englishText, sinhalaText, tamilText } = request.payload;
  const message = [englishText, sinhalaText, tamilText]
    .map((text) => text.trim())
    .filter(Boolean)
    .join(" | ");

  return `${message} | Ref ${request.warningId} (DMC Sri Lanka)`;
}

/** Sinhala and Tamil have no place in a `plain` SMS, so they become spaces. */
export function plainSmsText(text: string): string {
  return text.replace(/[^\x20-\x7E]+/g, " ").replace(/\s+/g, " ").trim();
}

/** The wording already names the alert, so the SMS does not say it twice. */
const ALERT_BRANDING = /^(safeplus|dmc)\s+(alert|warning)\s*[:\-]?\s*/i;

/**
 * The text the network actually carries. Text.lk documents one message type,
 * `plain`, and a body holding Sinhala or Tamil code points sent as plain
 * arrives at the handset empty - so the carrier leg is the English wording,
 * the DMC level, the instruction and the reference, while the trilingual text
 * above stays in the inbox.
 */
export function buildCarrierMessage(request: DispatchRequest): string {
  const areaLabel = `${request.targetDistrict} District`;
  const detail =
    plainSmsText(request.payload.englishText.replace(ALERT_BRANDING, "")) ||
    `Warning: ${request.hazardType} in ${areaLabel}.`;
  const instruction = plainSmsText(
    request.safetyInstructions?.trim() || defaultInstruction(request.severityLevel)
  );

  return plainSmsText(
    [
      `SAFEPLUS ALERT ${alertLevelLabel(request.severityLevel)}`,
      detail,
      `Do this: ${instruction}`,
      `Ref ${request.warningId} (DMC Sri Lanka)`,
    ].join(" | ")
  );
}

/**
 * Carriers reject local format, so `0771234567` and `+94 77 123 4567` both
 * become `+94771234567`. Anything that is not a Sri Lankan mobile number
 * returns null instead of being handed to the SMSC to fail silently.
 */
export function toInternationalMsisdn(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");

  const national = digits.startsWith("00")
    ? digits.slice(2)
    : digits.startsWith("94")
      ? digits
      : digits.startsWith("0")
        ? `94${digits.slice(1)}`
        : digits.length === 9
          ? `94${digits}`
          : digits;

  return /^947\d{8}$/.test(national) ? `+${national}` : null;
}

/** A carrier that hangs must not hold the broadcast until the dispatcher's deadline. */
const SMSC_REQUEST_TIMEOUT_MS = 12_000;

/**
 * POSTs to a carrier and leaves the status reading to the caller, since some
 * gateways answer 200 for a rejected batch and others answer 4xx.
 */
async function postJson(
  endpoint: string,
  body: Record<string, unknown>,
  accessToken?: string
): Promise<Response> {
  try {
    return await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SMSC_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(carrierUnreachable(error, endpoint));
  }
}

function carrierUnreachable(error: unknown, endpoint: string): string {
  if (error instanceof Error && /^(TimeoutError|AbortError)$/.test(error.name)) {
    return `did not answer within ${SMSC_REQUEST_TIMEOUT_MS / 1000}s (${endpoint}).`;
  }

  const cause = (error as { cause?: { code?: string } } | undefined)?.cause;
  const reason =
    cause?.code ?? (error instanceof Error ? error.message : String(error));

  return `could not be reached (${reason}).`;
}

/** What the carrier actually took off our hands, told number by number. */
export interface CarrierReply {
  delivered: string[];
  errors: string[];
}

/** Hands a batch to a carrier and reports which numbers it accepted. */
export type SmsTransport = (
  destinations: string[],
  message: string
) => Promise<CarrierReply>;

export interface SmsGateway {
  /** Names the carrier in the audit trail so an officer knows where the text went. */
  name: string;
  transport: SmsTransport;
}

async function postSmsc(
  endpoint: string,
  body: Record<string, unknown>
): Promise<number> {
  const response = await postJson(endpoint, body);

  if (!response.ok) {
    throw new Error(`responded with ${response.status}`);
  }

  const data = (await response.json().catch(() => ({}))) as { accepted?: number };

  return Number(data.accepted ?? 0);
}

const TWILIO_MESSAGES_PATH = "/2010-04-07/Accounts";

/** Twilio hands the message to its own queue before the handset confirms it. */
const TWILIO_ACCEPTED = new Set(["queued", "accepted", "sending", "sent"]);

/**
 * Twilio answers a bad SID and a bad token with the same 20404 rather than
 * leaking which half failed, so both are reported as one credential problem.
 */
const TWILIO_CREDENTIAL_FAILURES = new Set([20404, 20003, 20008]);

interface TwilioReply {
  status?: string;
  code?: number;
  message?: string;
}

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  /** Override for accounts that live outside the default US1 region. */
  apiBaseUrl: string;
}

export function twilioCredentials(
  env: NodeJS.ProcessEnv = process.env
): TwilioCredentials {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = env.TWILIO_FROM_NUMBER?.trim();
  const missing = [
    !accountSid && "TWILIO_ACCOUNT_SID",
    !authToken && "TWILIO_AUTH_TOKEN",
    !fromNumber && "TWILIO_FROM_NUMBER",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `SMS_PROVIDER=twilio but ${missing.join(", ")} ${
        missing.length === 1 ? "is" : "are"
      } not set.`
    );
  }

  return {
    accountSid: accountSid!,
    authToken: authToken!,
    fromNumber: fromNumber!,
    apiBaseUrl: (env.TWILIO_API_BASE_URL?.trim() || "https://api.twilio.com").replace(
      /\/+$/,
      ""
    ),
  };
}

/**
 * Text.lk is the Sri Lankan carrier of this deployment. It takes one number per
 * request in national format, so delivery can be attributed to a specific
 * handset, and it answers 200 with `status: "error"` as often as it answers
 * 4xx - the body has the final word.
 */
const TEXTLK_ENDPOINT = "https://app.text.lk/api/v3/sms/send";

interface TextLkReply {
  status?: string;
  message?: string;
}

/**
 * Text.lk's own parameter table lists `plain` as the only type for a text
 * message. An undocumented value such as `unicode` is accepted and billed, then
 * delivered as an empty SMS, so the default never changes by itself.
 */
export function textLkMessageType(
  configured = process.env.TEXTLK_MESSAGE_TYPE?.trim().toLowerCase()
): string {
  return configured || "plain";
}

export function textLkSenderId(): string {
  return process.env.TEXTLK_SENDER_ID?.trim() || smsSenderId();
}

export async function sendViaTextLk(
  destinations: string[],
  message: string,
  apiKey = process.env.TEXTLK_API_KEY?.trim(),
  senderId = textLkSenderId()
): Promise<CarrierReply> {
  if (!apiKey) {
    throw new Error("SMS_PROVIDER=textlk but TEXTLK_API_KEY is not set.");
  }

  const settled = await Promise.all(
    destinations.map(async (to): Promise<string | null> => {
      const response = await postJson(
        TEXTLK_ENDPOINT,
        {
          recipient: to.replace(/^\+/, ""),
          sender_id: senderId,
          type: textLkMessageType(),
          message,
        },
        apiKey
      );
      const reply = (await response.json().catch(() => ({}))) as TextLkReply;

      return response.ok && reply.status === "success"
        ? null
        : `${to}: ${reply.message ?? `Text.lk responded with ${response.status}`}`;
    })
  );

  return {
    delivered: destinations.filter((_, index) => settled[index] === null),
    errors: settled.filter((error): error is string => error !== null),
  };
}

/**
 * Twilio has no batch endpoint, so every number is its own message and each one
 * reports back separately - a trial account that refuses an unverified number
 * still delivers the rest. Sinhala and Tamil force UCS-2 encoding, so the
 * trilingual body costs several segments per handset.
 */
export async function sendViaTwilio(
  destinations: string[],
  message: string,
  credentials = twilioCredentials()
): Promise<CarrierReply> {
  const endpoint = `${credentials.apiBaseUrl}${TWILIO_MESSAGES_PATH}/${encodeURIComponent(
    credentials.accountSid
  )}/Messages.json`;
  const basicAuth = Buffer.from(
    `${credentials.accountSid}:${credentials.authToken}`
  ).toString("base64");

  const settled = await Promise.all(
    destinations.map(async (to): Promise<string | null> => {
      const response = await postForm(
        endpoint,
        new URLSearchParams({
          To: to,
          From: credentials.fromNumber,
          Body: message,
        }),
        basicAuth
      );
      const reply = (await response.json().catch(() => ({}))) as TwilioReply;

      if (!response.ok) {
        if (reply.code && TWILIO_CREDENTIAL_FAILURES.has(reply.code)) {
          throw new Error(
            `rejected the request (Twilio error ${reply.code}). Either the Account SID and Auth Token are not a matching pair for this endpoint, or this account is only served by the newer messaging.twilio.com/v1 API rather than the legacy 2010-04-07 one.`
          );
        }

        return `${to}: ${reply.message ?? `HTTP ${response.status}`}${
          reply.code ? ` (Twilio error ${reply.code})` : ""
        }`;
      }

      return TWILIO_ACCEPTED.has(reply.status ?? "")
        ? null
        : `${to}: carrier reported "${reply.status ?? "unknown"}".`;
    })
  );

  return {
    delivered: destinations.filter((_, index) => settled[index] === null),
    errors: settled.filter((error): error is string => error !== null),
  };
}

async function postForm(
  endpoint: string,
  form: URLSearchParams,
  basicAuth: string
): Promise<Response> {
  try {
    return await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        authorization: `Basic ${basicAuth}`,
      },
      body: form.toString(),
      signal: AbortSignal.timeout(SMSC_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(carrierUnreachable(error, endpoint));
  }
}

function genericSmsc(gatewayUrl: string): SmsGateway {
  return {
    name: "SMSC",
    transport: async (destinations, message) => {
      const accepted = await postSmsc(gatewayUrl, {
        sender: smsSenderId(),
        destinations,
        message,
      });

      return accepted >= destinations.length
        ? { delivered: destinations, errors: [] }
        : {
            delivered: [],
            errors: [
              `SMSC accepted ${accepted} of ${destinations.length} messages.`,
            ],
          };
    },
  };
}

/**
 * Picks the carrier from the environment. A deployment with neither setting
 * still stores every text for the in-app inbox, but the channel reports that
 * as simulated rather than claiming a sweep over the network.
 */
export function resolveSmsGateway(
  provider = process.env.SMS_PROVIDER?.trim().toLowerCase(),
  gatewayUrl = process.env.SMS_GATEWAY_URL
): SmsGateway | null {
  if (provider === "textlk" || provider === "text.lk") {
    return { name: "Text.lk", transport: sendViaTextLk };
  }

  if (provider === "twilio") {
    return { name: "Twilio", transport: sendViaTwilio };
  }

  return gatewayUrl ? genericSmsc(gatewayUrl) : null;
}

/**
 * The SMS channel of UC-01.
 *
 * A text only counts as delivered when the citizen's handset can show it, so
 * this channel hands the message to the carrier when the deployment has one and
 * stores it per recipient for the app's alert inbox. Without a carrier the
 * store is the delivery, reported as simulated so the audit trail never claims
 * a sweep that did not happen.
 */
export class SmsAlertChannel implements DisseminationChannel {
  readonly channelType = ChannelType.SMS;

  constructor(private readonly gateway: SmsGateway | null = resolveSmsGateway()) {}

  async send(request: DispatchRequest): Promise<ChannelResult> {
    const startedAt = Date.now();
    const cohort = request.recipients.filter(
      (recipient): recipient is AlertRecipient & { phoneNumber: string } =>
        Boolean(recipient.phoneNumber)
    );
    const targetCount = cohort.length;

    if (targetCount === 0) {
      return {
        status: BroadcastStatus.SKIPPED,
        targetCount: 0,
        deliveryCount: 0,
        failureCount: 0,
        elapsedMs: Date.now() - startedAt,
        errorMessage: `No account in ${request.targetDistrict} District has a phone number, so no text was sent.`,
        simulated: false,
      };
    }

    const levelLabel = alertLevelLabel(request.severityLevel);
    const areaLabel = `${request.targetDistrict} District`;
    const instruction =
      request.safetyInstructions?.trim() || defaultInstruction(request.severityLevel);
    const body = buildSmsBody(request);
    const carrierMessage = buildCarrierMessage(request);
    let reachable = cohort;
    let carrierNote: string | undefined;

    if (this.gateway) {
      const reply = await this.handToCarrier(this.gateway, cohort, carrierMessage);
      const accepted = new Set(reply.delivered);

      reachable = cohort.filter(
        (recipient) => accepted.has(toInternationalMsisdn(recipient.phoneNumber) ?? "")
      );

      if (reachable.length === 0) {
        return {
          status: BroadcastStatus.FAILED,
          targetCount,
          deliveryCount: 0,
          failureCount: targetCount,
          elapsedMs: Date.now() - startedAt,
          errorMessage: reply.errors[0],
          simulated: false,
        };
      }

      carrierNote = reply.errors[0];
    }

    const delivered = await insertAlertSms(
      reachable.map<NewAlertSms>((recipient) => ({
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
      errorMessage: this.gateway
        ? carrierNote
        : "No carrier gateway is configured (SMS_PROVIDER=textlk or SMS_GATEWAY_URL), so this text was stored for the in-app inbox instead of sent over the network.",
      simulated: !this.gateway,
    };
  }

  private async handToCarrier(
    gateway: SmsGateway,
    cohort: (AlertRecipient & { phoneNumber: string })[],
    body: string
  ): Promise<CarrierReply> {
    const destinations: string[] = [];
    const errors: string[] = [];

    for (const recipient of cohort) {
      const msisdn = toInternationalMsisdn(recipient.phoneNumber);

      if (msisdn) {
        destinations.push(msisdn);
      } else {
        errors.push(`${recipient.phoneNumber} is not a Sri Lankan mobile number.`);
      }
    }

    if (destinations.length === 0) {
      return {
        delivered: [],
        errors: ["None of the registered numbers is a valid Sri Lankan mobile number."],
      };
    }

    try {
      const reply = await gateway.transport(destinations, body);

      return { delivered: reply.delivered, errors: [...errors, ...reply.errors] };
    } catch (error) {
      return {
        delivered: [],
        errors: [
          ...errors,
          `${gateway.name}: ${error instanceof Error ? error.message : "unavailable."}`,
        ],
      };
    }
  }
}
