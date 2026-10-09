import { describe, expect, it } from "vitest";

import {
  channelLabel,
  deliveryLabel,
  deliveryPill,
  isDeliveryError,
  meterTone,
  severityPill,
  skippedCopy,
  statusPill,
} from "./dushani-dataStyles";

describe("severityPill", () => {
  it("gives every severity its own colour so a row reads the same portal wide", () => {
    expect(severityPill("CRITICAL")).toBe("sp-pill-red");
    expect(severityPill("HIGH")).toBe("sp-pill-amber");
    expect(severityPill("MEDIUM")).toBe("sp-pill-blue");
    expect(severityPill("LOW")).toBe("sp-pill-slate");
  });
});

describe("statusPill", () => {
  it("marks a live warning red and anything still waiting for action amber", () => {
    expect(statusPill("ACTIVE")).toBe("sp-pill-red");
    expect(statusPill("DRAFT")).toBe("sp-pill-amber");
    expect(statusPill("PENDING_DISPATCH")).toBe("sp-pill-amber");
    expect(statusPill("EXPIRED")).toBe("sp-pill-slate");
    expect(statusPill("STOOD_DOWN")).toBe("sp-pill-slate");
  });
});

describe("channelLabel", () => {
  it("names a channel the way an officer would say it, not as a database enum", () => {
    expect(channelLabel("push")).toBe("Push notification");
    expect(channelLabel("sms")).toBe("Text and app inbox");
    expect(channelLabel("siren")).toBe("Siren relay");
  });
});

describe("deliveryLabel", () => {
  it("describes the outcome as a state", () => {
    expect(deliveryLabel("SUCCESS")).toBe("Delivered");
    expect(deliveryLabel("PARTIAL")).toBe("Part delivered");
    expect(deliveryLabel("FAILED")).toBe("Failed");
    expect(deliveryLabel("PENDING")).toBe("Waiting");
    expect(deliveryLabel("SKIPPED")).toBe("No receivers");
  });
});

describe("isDeliveryError", () => {
  it("only treats a real send failure as an error", () => {
    expect(isDeliveryError("FAILED")).toBe(true);
    expect(isDeliveryError("SKIPPED")).toBe(false);
    expect(isDeliveryError("PARTIAL")).toBe(false);
    expect(isDeliveryError("PENDING")).toBe(false);
    expect(isDeliveryError("SUCCESS")).toBe(false);
  });
});

describe("deliveryPill and meterTone", () => {
  it("keeps the pill and the bar in the same colour family", () => {
    expect(deliveryPill("SUCCESS")).toBe("sp-pill-green");
    expect(meterTone("SUCCESS")).toBe("");

    expect(deliveryPill("PARTIAL")).toBe("sp-pill-amber");
    expect(meterTone("PARTIAL")).toBe("sp-meter-fill-amber");

    expect(deliveryPill("FAILED")).toBe("sp-pill-red");
    expect(meterTone("FAILED")).toBe("sp-meter-fill-red");

    expect(deliveryPill("PENDING")).toBe("sp-pill-slate");
    expect(meterTone("PENDING")).toBe("sp-meter-fill-amber");

    expect(deliveryPill("SKIPPED")).toBe("sp-pill-slate");
    expect(meterTone("SKIPPED")).toBe("");
  });
});

describe("skippedCopy", () => {
  it("explains why a channel had nobody to reach, and what to do next", () => {
    expect(skippedCopy("push")).toEqual({
      reason: "No phone in this district has notifications enabled",
      nextStep: "Open the citizen app once and allow notifications",
    });

    expect(skippedCopy("sms")).toEqual({
      reason: "No targeted account has a phone number",
      nextStep: "Nothing to fix - the warning still reaches the app inbox",
    });

    expect(skippedCopy("siren")).toEqual({
      reason: "No siren station answered the relay",
      nextStep: "Point SIREN_RELAY_URL at the station network",
    });
  });

  it("never tells the officer a skipped channel failed", () => {
    for (const channel of ["push", "sms", "siren"] as const) {
      const copy = skippedCopy(channel);

      expect(copy.reason).not.toMatch(/failed|error/i);
      expect(copy.nextStep.length).toBeGreaterThan(0);
    }
  });
});
