import {
  ChannelDispatcher,
  PushAlertChannel,
  SirenRelayAdapter,
  PUSH_RECEIPT_THRESHOLD,
  type AlertRecipient,
  type DispatchRequest,
  type DisseminationChannel,
} from "../services/dushani-disseminationChannels";
import { BroadcastStatus, ChannelType } from "../models/disasterWarning";

function request(overrides: Partial<DispatchRequest> = {}): DispatchRequest {
  return {
    warningInternalId: "00000000-0000-4000-8000-000000000001",
    warningId: "WARN-2026-0001",
    hazardType: "FLOOD",
    severityLevel: "CRITICAL",
    targetDistrict: "Colombo",
    safetyInstructions: "Move to higher ground immediately.",
    payload: {
      englishText: "Severe flooding expected in Colombo basin.",
      sinhalaText: "කොළඹ දිස්ත්රික්කයට අතිවිශාල ගංදුවක්.",
      tamilText: " கொழும்பு நீர்த்தேக்கம்.",
    },
    recipients: [],
    ...overrides,
  };
}

function expoToken(index: number): string {
  return `ExponentPushToken[test-token-${index}]`;
}

function recipients(count: number, offset = 0): AlertRecipient[] {
  return Array.from({ length: count }, (_, index) => ({
    userId: `user-${offset + index}`,
    deviceToken: expoToken(offset + index),
    phoneNumber: `0771234${String(offset + index).padStart(3, "0")}`,
  }));
}

afterEach(() => {
  (global as { fetch?: unknown }).fetch = undefined;
});

describe("PushAlertChannel", () => {
  it("reports a district with no registered handset as SKIPPED, not FAILED", async () => {
    const result = await new PushAlertChannel().send(
      request({ recipients: [{ userId: "a" }, { userId: "b" }] })
    );

    expect(result.status).toBe(BroadcastStatus.SKIPPED);
    expect(result.targetCount).toBe(0);
    expect(result.failureCount).toBe(0);
    expect(result.simulated).toBe(false);
    expect(result.errorMessage).toContain("Colombo District");
  });

  it("keeps a real misconfiguration - tokens from another provider - as FAILED", async () => {
    const result = await new PushAlertChannel().send(
      request({
        recipients: [{ userId: "a", deviceToken: "fcm-raw-token-xyz" }],
      })
    );

    expect(result.status).toBe(BroadcastStatus.FAILED);
    expect(result.errorMessage).toContain("not Expo push tokens");
  });

  it("counts a gateway that took the whole batch as SUCCESS", async () => {
    const batch = recipients(3);
    const post = jest.fn(async () => ({
      ok: true,
      json: async () => ({ accepted: 3 }),
    }));

    (global as { fetch: unknown }).fetch = post;

    const result = await new PushAlertChannel("https://push.test/send").send(
      request({ recipients: batch })
    );

    expect(result.status).toBe(BroadcastStatus.SUCCESS);
    expect(result.deliveryCount).toBe(3);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("splits a partially accepted batch into PARTIAL with the remainder failed", async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ accepted: 1 }),
    }));

    const result = await new PushAlertChannel("https://push.test/send").send(
      request({ recipients: recipients(4) })
    );

    expect(result.status).toBe(BroadcastStatus.PARTIAL);
    expect(result.deliveryCount).toBe(1);
    expect(result.failureCount).toBe(3);
  });

  it("turns a rejected gateway response into a FAILED channel, not a throw", async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => ({}),
    }));

    const result = await new PushAlertChannel("https://push.test/send").send(
      request({ recipients: recipients(2) })
    );

    expect(result.status).toBe(BroadcastStatus.FAILED);
    expect(result.errorMessage).toContain("502");
  });
});

describe("SirenRelayAdapter", () => {
  it("calls an unconfigured relay a simulation instead of claiming a sounding", async () => {
    const result = await new SirenRelayAdapter(undefined).send(request());

    expect(result.status).toBe(BroadcastStatus.SUCCESS);
    expect(result.simulated).toBe(true);
    expect(result.errorMessage).toContain("SIREN_RELAY_URL");
  });

  it("records a dead relay as that channel's failure", async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    const result = await new SirenRelayAdapter("https://siren.test/activate").send(
      request({ recipients: recipients(2) })
    );

    expect(result.status).toBe(BroadcastStatus.FAILED);
    expect(result.errorMessage).toContain("ECONNREFUSED");
  });
});

function fakeChannel(
  channelType: ChannelType,
  outcome: {
    status?: BroadcastStatus;
    targetCount?: number;
    deliveryCount?: number;
    delayMs?: number;
  }
): DisseminationChannel & { calls: number } {
  let calls = 0;

  return {
    channelType,
    get calls() {
      return calls;
    },
    async send() {
      calls += 1;

      if (outcome.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, outcome.delayMs));
      }

      const targetCount = outcome.targetCount ?? 10;

      return {
        status: outcome.status ?? BroadcastStatus.SUCCESS,
        targetCount,
        deliveryCount: outcome.deliveryCount ?? targetCount,
        failureCount: targetCount - (outcome.deliveryCount ?? targetCount),
        elapsedMs: outcome.delayMs ?? 0,
        simulated: false,
      };
    },
  };
}

function warningFixture() {
  return {
    id: "warning-uuid",
    warningId: "WARN-2026-0001",
    reportId: "report-uuid",
    hazardType: "FLOOD",
    severityLevel: "CRITICAL",
    targetDistrict: "Colombo",
    safetyInstructions: "Move to higher ground.",
    status: "ACTIVE" as never,
    englishMessage: "English warning text for the broadcast.",
    sinhalaMessage: "සිංහල පණිවිඩය",
    tamilMessage: "தமிழ் செய்தி",
    channels: { push: true, sms: false, siren: false } as never,
    officerId: "officer-1",
    audienceCount: 10,
    smsRecipientCount: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("ChannelDispatcher", () => {
  it("falls back to SMS when push receipts land below the 40% rule", async () => {
    const sms = fakeChannel(ChannelType.SMS, {});
    const dispatcher = new ChannelDispatcher(1_000);

    dispatcher.registerChannel(
      fakeChannel(ChannelType.PUSH, { targetCount: 10, deliveryCount: 3 })
    );
    dispatcher.registerChannel(sms);

    const outcome = await dispatcher.dispatch(
      warningFixture() as never,
      [ChannelType.PUSH],
      recipients(10)
    );

    expect(outcome.pushReceiptRatio).toBeCloseTo(0.3);
    expect(outcome.pushReceiptRatio).toBeLessThan(PUSH_RECEIPT_THRESHOLD);
    expect(outcome.smsFallbackTriggered).toBe(true);
    expect(sms.calls).toBe(1);
  });

  it("does not re-send SMS when the officer already selected that channel", async () => {
    const sms = fakeChannel(ChannelType.SMS, {});
    const dispatcher = new ChannelDispatcher(1_000);

    dispatcher.registerChannel(
      fakeChannel(ChannelType.PUSH, { targetCount: 10, deliveryCount: 1 })
    );
    dispatcher.registerChannel(sms);

    const outcome = await dispatcher.dispatch(
      warningFixture() as never,
      [ChannelType.PUSH, ChannelType.SMS],
      recipients(10)
    );

    expect(outcome.smsFallbackTriggered).toBe(false);
    expect(sms.calls).toBe(1);
  });

  it("skips the fallback when nobody has a number to text", async () => {
    const sms = fakeChannel(ChannelType.SMS, {});
    const dispatcher = new ChannelDispatcher(1_000);

    dispatcher.registerChannel(
      fakeChannel(ChannelType.PUSH, { targetCount: 4, deliveryCount: 0 })
    );
    dispatcher.registerChannel(sms);

    const outcome = await dispatcher.dispatch(
      warningFixture() as never,
      [ChannelType.PUSH],
      [
        { userId: "a", deviceToken: expoToken(1) },
        { userId: "b", deviceToken: expoToken(2) },
      ]
    );

    expect(outcome.smsFallbackTriggered).toBe(false);
    expect(sms.calls).toBe(0);
  });

  it("treats a push that found no receivers as a full ratio, so no phantom SMS runs", async () => {
    const sms = fakeChannel(ChannelType.SMS, {});
    const dispatcher = new ChannelDispatcher(1_000);

    dispatcher.registerChannel(
      fakeChannel(ChannelType.PUSH, {
        status: BroadcastStatus.SKIPPED,
        targetCount: 0,
        deliveryCount: 0,
      })
    );
    dispatcher.registerChannel(sms);

    const outcome = await dispatcher.dispatch(
      warningFixture() as never,
      [ChannelType.PUSH],
      [{ userId: "a", phoneNumber: "0771234567" }]
    );

    expect(outcome.pushReceiptRatio).toBe(1);
    expect(outcome.smsFallbackTriggered).toBe(false);
  });

  it("fails a selected channel that was never registered", async () => {
    const dispatcher = new ChannelDispatcher(1_000);

    dispatcher.registerChannel(fakeChannel(ChannelType.PUSH, { targetCount: 1 }));

    const outcome = await dispatcher.dispatch(
      warningFixture() as never,
      [ChannelType.PUSH, ChannelType.SIREN],
      recipients(1)
    );

    expect(outcome.results.get(ChannelType.SIREN)?.status).toBe(
      BroadcastStatus.FAILED
    );
    expect(outcome.results.get(ChannelType.SIREN)?.errorMessage).toContain(
      "not registered"
    );
  });

  it("records a hung channel as a timeout rather than holding the broadcast open", async () => {
    const dispatcher = new ChannelDispatcher(50);

    dispatcher.registerChannel(
      fakeChannel(ChannelType.PUSH, { targetCount: 2, delayMs: 400 })
    );

    const outcome = await dispatcher.dispatch(
      warningFixture() as never,
      [ChannelType.PUSH],
      recipients(2)
    );

    const push = outcome.results.get(ChannelType.PUSH);

    expect(push?.status).toBe(BroadcastStatus.FAILED);
    expect(push?.errorMessage).toContain("No delivery receipts within 0s");
  });
});
