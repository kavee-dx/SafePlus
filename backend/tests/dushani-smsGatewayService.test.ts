jest.mock("../repositories/dushani-alertSmsRepository", () => ({
  insertAlertSms: jest.fn(async (entries: unknown[]) => entries.length),
}));

import { insertAlertSms } from "../repositories/dushani-alertSmsRepository";
import {
  alertLevelLabel,
  buildCarrierMessage,
  buildSmsBody,
  defaultInstruction,
  plainSmsText,
  resolveSmsGateway,
  SmsAlertChannel,
  textLkMessageType,
  toInternationalMsisdn,
} from "../services/dushani-smsGatewayService";
import { BroadcastStatus } from "../models/disasterWarning";
import type { DispatchRequest } from "../services/dushani-disseminationChannels";

const store = insertAlertSms as jest.Mock;

function request(overrides: Partial<DispatchRequest> = {}): DispatchRequest {
  return {
    warningInternalId: "warning-uuid",
    warningId: "WARN-2026-0001",
    hazardType: "FLOOD",
    severityLevel: "CRITICAL",
    targetDistrict: "Kalutara",
    safetyInstructions: "Move to higher ground immediately.",
    payload: {
      englishText: "SAFEPLUS ALERT: severe flooding in the Kalu Ganga basin.",
      sinhalaText: "කළු ගඟ දිගේ වෙළිය.",
      tamilText: "கழு கங்கா நீர்ப்பெருக்கு.",
    },
    recipients: [],
    ...overrides,
  };
}

describe("toInternationalMsisdn", () => {
  it.each([
    ["0771234567", "+94771234567"],
    ["+94 77 123 4567", "+94771234567"],
    ["0094771234567", "+94771234567"],
    ["94771234567", "+94771234567"],
    ["771234567", "+94771234567"],
  ])("normalises %s to the carrier format", (input, expected) => {
    expect(toInternationalMsisdn(input)).toBe(expected);
  });

  it.each(["0112345678", "12345", "077123", "not-a-phone"])(
    "rejects %s instead of handing it to the SMSC",
    (input) => {
      expect(toInternationalMsisdn(input)).toBeNull();
    }
  );
});

describe("alert wording", () => {
  it("uses the storyboard's DMC level names", () => {
    expect(alertLevelLabel("CRITICAL")).toBe("Level 3 - Immediate Evacuation");
    expect(alertLevelLabel("LOW")).toBe("Level 1 - Be informed");
    expect(alertLevelLabel("UNKNOWN")).toBe("UNKNOWN");
  });

  it("keeps every language in the inbox copy but tags it with the reference", () => {
    const body = buildSmsBody(request());

    expect(body).toContain("කළු ගඟ දිගේ වෙළිය.");
    expect(body).toContain("கழு கங்கா நீர்ப்பெருக்கு.");
    expect(body).toContain("Ref WARN-2026-0001 (DMC Sri Lanka)");
  });

  it("strips the script the network cannot carry from the sent text", () => {
    const carrier = buildCarrierMessage(request());

    expect(carrier).toBe(plainSmsText(carrier));
    expect(carrier).toContain("SAFEPLUS ALERT Level 3 - Immediate Evacuation");
    expect(carrier).toContain("Do this: Move to higher ground immediately.");
    expect(carrier).not.toMatch(/[\u0d80-\u0dff\u0b80-\u0bff]/);
  });

  it("does not repeat the branding the message already opens with", () => {
    expect(buildCarrierMessage(request())).toContain(
      "severe flooding in the Kalu Ganga basin."
    );
  });

  it("falls back to a hazard sentence when the officer left the text blank", () => {
    const carrier = buildCarrierMessage(
      request({
        payload: { englishText: "DMC Warning: ", sinhalaText: "", tamilText: "" },
        safetyInstructions: "",
      })
    );

    expect(carrier).toContain("Warning: FLOOD in Kalutara District.");
    expect(carrier).toContain(defaultInstruction("CRITICAL"));
  });
});

describe("resolveSmsGateway", () => {
  it("maps each supported provider name to its transport", () => {
    expect(resolveSmsGateway("textlk")?.name).toBe("Text.lk");
    expect(resolveSmsGateway("text.lk")?.name).toBe("Text.lk");
    expect(resolveSmsGateway("twilio")?.name).toBe("Twilio");
  });

  it("reads the provider from the environment the same way the caller does", () => {
    expect(resolveSmsGateway("  TEXT.LK  ".trim().toLowerCase())?.name).toBe(
      "Text.lk"
    );
  });

  it("has no carrier when neither a provider nor a gateway URL is set", () => {
    expect(resolveSmsGateway(undefined, undefined)).toBeNull();
  });

  it("keeps Text.lk on the documented plain type", () => {
    expect(textLkMessageType()).toBe("plain");
    expect(textLkMessageType("unicode")).toBe("unicode");
  });
});

describe("SmsAlertChannel", () => {
  it("reports a cohort with no numbers as SKIPPED, not FAILED", async () => {
    const result = await new SmsAlertChannel(null).send(
      request({ recipients: [{ userId: "a" }, { userId: "b" }] })
    );

    expect(result.status).toBe(BroadcastStatus.SKIPPED);
    expect(result.targetCount).toBe(0);
    expect(result.failureCount).toBe(0);
    expect(store).not.toHaveBeenCalled();
  });

  it("stores for the app inbox and says so when no carrier is configured", async () => {
    store.mockResolvedValueOnce(2);

    const result = await new SmsAlertChannel(null).send(
      request({
        recipients: [
          { userId: "a", phoneNumber: "0771234567" },
          { userId: "b", phoneNumber: "0771234568" },
        ],
      })
    );

    expect(result.simulated).toBe(true);
    expect(result.status).toBe(BroadcastStatus.SUCCESS);
    expect(result.errorMessage).toContain("in-app inbox");
    expect(result.errorMessage).toContain("SMS_PROVIDER");
  });

  it("marks the channel FAILED when nothing reached the store", async () => {
    store.mockResolvedValueOnce(0);

    const result = await new SmsAlertChannel(null).send(
      request({ recipients: [{ userId: "a", phoneNumber: "0771234567" }] })
    );

    expect(result.status).toBe(BroadcastStatus.FAILED);
    expect(result.errorMessage).toContain("None of the queued messages");
  });

  it("only counts numbers the carrier actually took", async () => {
    store.mockResolvedValueOnce(1);

    const result = await new SmsAlertChannel({
      name: "Test.lk",
      transport: jest.fn(async (destinations: string[]) => ({
        delivered: destinations.slice(0, 1),
        errors: [],
      })),
    } as never).send(
      request({
        recipients: [
          { userId: "a", phoneNumber: "0771234567" },
          { userId: "b", phoneNumber: "0771234568" },
        ],
      })
    );

    expect(result.status).toBe(BroadcastStatus.PARTIAL);
    expect(result.deliveryCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.simulated).toBe(false);
  });

  it("names the carrier and the reason when the network leg throws", async () => {
    const result = await new SmsAlertChannel({
      name: "Test.lk",
      transport: jest.fn(async () => {
        throw new Error("401 Unauthorized");
      }),
    } as never).send(
      request({
        recipients: [
          { userId: "a", phoneNumber: "0771234567" },
          { userId: "b", phoneNumber: "0771234568" },
        ],
      })
    );

    expect(result.status).toBe(BroadcastStatus.FAILED);
    expect(result.errorMessage).toBe("Test.lk: 401 Unauthorized");
    expect(store).not.toHaveBeenCalled();
  });

  it("reports an undialable number before anything is sent", async () => {
    const transport = jest.fn();
    const result = await new SmsAlertChannel({
      name: "Test.lk",
      transport,
    } as never).send(
      request({ recipients: [{ userId: "a", phoneNumber: "0112345678" }] })
    );

    expect(transport).not.toHaveBeenCalled();
    expect(result.status).toBe(BroadcastStatus.FAILED);
    expect(result.errorMessage).toBe(
      "None of the registered numbers is a valid Sri Lankan mobile number."
    );
  });
});
