import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SEVERITY_CLASS,
  STATUS_META,
  formatDateTime,
  label,
  relativeTime,
} from "../src/pages/amasha-reportUi";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("label", () => {
  it("turns the API's snake case codes into readable words", () => {
    expect(label("HEAVY_RAIN")).toBe("Heavy Rain");
    expect(label("PENDING_VERIFICATION")).toBe("Pending Verification");
    expect(label("FLOOD")).toBe("Flood");
  });
});

describe("relativeTime", () => {
  it("says just now for anything under a minute old, including a future timestamp", () => {
    expect(relativeTime("2026-10-09T12:00:00.000Z")).toBe("just now");
    expect(relativeTime("2026-10-09T12:00:30.000Z")).toBe("just now");
    expect(relativeTime("2026-10-09T12:01:00.000Z")).toBe("just now");
  });

  it("counts minutes under an hour", () => {
    expect(relativeTime("2026-10-09T11:30:00.000Z")).toBe("30 min ago");
  });

  it("switches to hours and pluralises only when needed", () => {
    expect(relativeTime("2026-10-09T11:00:00.000Z")).toBe("1 hour ago");
    expect(relativeTime("2026-10-09T07:00:00.000Z")).toBe("5 hours ago");
  });

  it("switches to days beyond a day", () => {
    expect(relativeTime("2026-10-08T12:00:00.000Z")).toBe("1 day ago");
    expect(relativeTime("2026-10-06T12:00:00.000Z")).toBe("3 days ago");
  });
});

describe("formatDateTime", () => {
  it("leaves a blank as an em dash", () => {
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("")).toBe("—");
  });

  it("leaves an unparseable stamp as an em dash", () => {
    expect(formatDateTime("not-a-date")).toBe("—");
  });

  it("formats a real stamp through the officer's locale", () => {
    const iso = "2026-10-01T04:30:00.000Z";

    expect(formatDateTime(iso)).toBe(new Date(iso).toLocaleString());
  });
});

describe("queue presentation contract", () => {
  it("has a colour class for every severity the API can send", () => {
    expect(Object.keys(SEVERITY_CLASS).sort()).toEqual([
      "CRITICAL",
      "HIGH",
      "LOW",
      "MEDIUM",
    ]);
    expect(SEVERITY_CLASS.CRITICAL).toBe("rc-sev-critical");
  });

  it("has human labels for every report status, including the A2 state", () => {
    expect(Object.keys(STATUS_META).sort()).toEqual([
      "ADDITIONAL_INFO_REQUIRED",
      "PENDING_VERIFICATION",
      "REJECTED",
      "RESOLVED",
      "VERIFIED",
    ]);
    expect(STATUS_META.PENDING_VERIFICATION.label).toBe("Awaiting verification");
    expect(STATUS_META.ADDITIONAL_INFO_REQUIRED.label).toBe(
      "Additional information required"
    );
  });
});
