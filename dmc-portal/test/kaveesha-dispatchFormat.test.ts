import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Colors } from "../src/constants/theme";
import {
  clockTime,
  formatDateTime,
  formatDistance,
  formatEta,
  humanizeHazard,
  isLiveStage,
  relativeTime,
  scoreColor,
  severityColor,
  stageMeta,
} from "../src/utils/kaveesha-dispatchFormat";
import type { DispatchStatus } from "../src/services/kaveesha-dispatchApi";

describe("humanizeHazard", () => {
  it("uses the curated control-room wording for a known code", () => {
    expect(humanizeHazard("FLOOD")).toBe("Flood");
    expect(humanizeHazard("STORM_SURGE")).toBe("Storm surge");
    expect(humanizeHazard("WOODLAND_FIRE")).toBe("Wildfire");
  });

  it("reads the code case-insensitively", () => {
    expect(humanizeHazard("cyclone")).toBe("Cyclone");
  });

  it("title-cases an unknown snake-case code rather than showing raw text", () => {
    expect(humanizeHazard("VOLCANIC_ASH")).toBe("Volcanic Ash");
    expect(humanizeHazard("single")).toBe("Single");
  });
});

describe("stageMeta", () => {
  it("labels a live stage with its tone and colour", () => {
    expect(stageMeta("RESCUE_IN_PROGRESS")).toEqual({
      label: "Rescue under way",
      tone: "live",
      color: Colors.red,
    });
    expect(stageMeta("COMPLETED").tone).toBe("done");
  });

  it("falls back to a de-underscored label for an unmapped status", () => {
    const meta = stageMeta("SOMETHING_NEW" as DispatchStatus);

    expect(meta.label).toBe("SOMETHING NEW");
    expect(meta.tone).toBe("closed");
    expect(meta.color).toBe(Colors.muted);
  });
});

describe("isLiveStage", () => {
  it("treats in-progress stages as live", () => {
    expect(isLiveStage("DISPATCHED")).toBe(true);
    expect(isLiveStage("EN_ROUTE")).toBe(true);
    expect(isLiveStage("RETURNING")).toBe(true);
  });

  it("treats terminal stages as not live", () => {
    expect(isLiveStage("COMPLETED")).toBe(false);
    expect(isLiveStage("DECLINED")).toBe(false);
    expect(isLiveStage("CANCELLED")).toBe(false);
  });
});

describe("severityColor", () => {
  it("maps each severity band to a colour, case-insensitively", () => {
    expect(severityColor("CRITICAL")).toBe(Colors.red);
    expect(severityColor("high")).toBe(Colors.amber);
    expect(severityColor("Moderate")).toBe(Colors.blue);
  });

  it("defaults an unknown severity to the muted colour", () => {
    expect(severityColor("LOW")).toBe(Colors.muted);
    expect(severityColor("")).toBe(Colors.muted);
  });
});

describe("scoreColor", () => {
  it("greens a strong fit and ambers a weak one", () => {
    expect(scoreColor(75)).toBe(Colors.success);
    expect(scoreColor(90)).toBe(Colors.success);
    expect(scoreColor(55)).toBe(Colors.blue);
    expect(scoreColor(74)).toBe(Colors.blue);
    expect(scoreColor(54)).toBe(Colors.amber);
    expect(scoreColor(0)).toBe(Colors.amber);
  });
});

describe("formatDistance", () => {
  it("switches to metres below a kilometre and keeps one decimal above", () => {
    expect(formatDistance(0.64)).toBe("640 m");
    expect(formatDistance(3.44)).toBe("3.4 km");
    expect(formatDistance(1)).toBe("1.0 km");
  });

  it("says the distance is unknown for a non-finite value", () => {
    expect(formatDistance(Number.NaN)).toBe("distance unknown");
    expect(formatDistance(Infinity)).toBe("distance unknown");
  });
});

describe("formatEta", () => {
  it("shows minutes below an hour", () => {
    expect(formatEta(45)).toBe("45 min");
    expect(formatEta(59.4)).toBe("59 min");
  });

  it("splits an hour-plus estimate into hours and minutes", () => {
    expect(formatEta(60)).toBe("1 h 0 min");
    expect(formatEta(95)).toBe("1 h 35 min");
  });

  it("shows a dash for a missing or non-positive estimate", () => {
    expect(formatEta(0)).toBe("—");
    expect(formatEta(-5)).toBe("—");
    expect(formatEta(Number.NaN)).toBe("—");
  });
});

describe("relativeTime", () => {
  const NOW = new Date("2026-06-01T12:00:00.000Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const ago = (ms: number) => new Date(NOW - ms).toISOString();

  it("returns a dash when there is nothing to show", () => {
    expect(relativeTime(null)).toBe("—");
    expect(relativeTime(undefined)).toBe("—");
    expect(relativeTime("not-a-date")).toBe("—");
  });

  it("describes the last few minutes in human terms", () => {
    expect(relativeTime(ago(10_000))).toBe("just now");
    expect(relativeTime(ago(80_000))).toBe("a minute ago");
    expect(relativeTime(ago(5 * 60_000))).toBe("5 min ago");
    expect(relativeTime(ago(3 * 3_600_000))).toBe("3 h ago");
  });

  it("counts whole days and pluralises them", () => {
    expect(relativeTime(ago(24 * 3_600_000))).toBe("1 day ago");
    expect(relativeTime(ago(3 * 24 * 3_600_000))).toBe("3 days ago");
  });

  it("switches to a calendar date once a month has passed", () => {
    expect(relativeTime(ago(40 * 24 * 3_600_000))).toBe(
      new Date(NOW - 40 * 24 * 3_600_000).toLocaleDateString()
    );
  });
});

describe("clockTime", () => {
  it("returns a dash for a missing or invalid timestamp", () => {
    expect(clockTime(null)).toBe("—");
    expect(clockTime("garbage")).toBe("—");
  });

  it("renders a valid instant as a local two-part clock string", () => {
    const out = clockTime("2026-06-01T12:00:00.000Z");

    expect(out).not.toBe("—");
    expect(out).toMatch(/\d/);
  });
});

describe("formatDateTime", () => {
  it("returns a dash for a missing or invalid timestamp", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("nope")).toBe("—");
  });

  it("joins a day-month label and a clock reading with a separator", () => {
    const out = formatDateTime("2026-06-01T12:00:00.000Z");

    expect(out).toContain("·");
    expect(out).toMatch(/\d/);
  });
});
