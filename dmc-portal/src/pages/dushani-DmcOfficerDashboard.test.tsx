import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchCoverage,
  fetchPendingReports,
  fetchWarnings,
} from "../services/dushani-alertApi";
import type { BroadcastLog, DisasterWarning } from "../types/warning";
import DmcOfficerDashboard from "./dushani-DmcOfficerDashboard";

vi.mock("../services/dushani-alertApi", () => ({
  deleteWarning: vi.fn(),
  extendWarningExpiry: vi.fn(),
  fetchCoverage: vi.fn(),
  fetchPendingReports: vi.fn(),
  fetchWarnings: vi.fn(),
  pinProblem: (failure: unknown) =>
    failure instanceof Error ? failure.message : "Problem.",
  standDownWarning: vi.fn(),
}));

vi.mock("../services/dmc-authApi", () => ({ getStoredDmcToken: () => "test-token" }));

// The sibling surfaces each own their own data; this page is under test.
vi.mock("../components/dushani-NotificationBell", () => ({ default: () => null }));
vi.mock("../components/dushani-ClearancePinCard", () => ({ default: () => null }));
vi.mock("./amasha-ReportCenter", () => ({ default: () => null }));
vi.mock("./dildhara-ProfilePage", () => ({ default: () => null }));

const { wizardProps } = vi.hoisted(() => ({
  wizardProps: [] as { initialReportId?: string; initialWarningId?: string }[],
}));

vi.mock("../components/dushani-WarningWizard", () => ({
  default: (props: { initialReportId?: string; initialWarningId?: string }) => {
    wizardProps.push(props);
    return null;
  },
}));

const log = (overrides: Partial<BroadcastLog>): BroadcastLog => ({
  id: `log-${Math.random().toString(36).slice(2)}`,
  warningId: "w-1",
  channelType: "push",
  status: "SUCCESS",
  dispatchedAt: "2026-10-09T08:00:00.000Z",
  targetCount: 3,
  deliveryCount: 3,
  failureCount: 0,
  ...overrides,
});

const warning = (overrides: Partial<DisasterWarning>): DisasterWarning => ({
  id: "w-1",
  warningId: "WARN-2026-0001",
  reportId: "r-1",
  hazardType: "FLOOD",
  severityLevel: "CRITICAL",
  targetDistrict: "Colombo",
  status: "ACTIVE",
  englishMessage: "Move to higher ground now.",
  sinhalaMessage: "ඉහළ බිමට යන්න.",
  tamilMessage: "உயர் இடத்திற்கு செல்லவும்.",
  channels: { push: true, sms: true, siren: false },
  officerId: "officer-1",
  audienceCount: 12,
  smsRecipientCount: 3,
  createdAt: "2026-10-09T08:00:00.000Z",
  updatedAt: "2026-10-09T08:05:00.000Z",
  ...overrides,
});

const officer = {
  id: "officer-1",
  fullName: "Dushani Naveendhya",
  email: "officer@dmc.gov.lk",
  role: "DMC_OFFICER" as const,
  status: "ACTIVE",
};

async function openHistory(items: DisasterWarning[]) {
  vi.mocked(fetchWarnings).mockResolvedValue(items);

  render(<DmcOfficerDashboard officer={officer} onLogout={vi.fn()} />);

  await screen.findByText("Overview");
  fireEvent.click(screen.getByRole("button", { name: "Alert history" }));
  await screen.findByText("Flood warning");
}

beforeEach(() => {
  vi.mocked(fetchCoverage).mockResolvedValue({ totalAlertedAccounts: 12, byDistrict: [] });
  vi.mocked(fetchPendingReports).mockResolvedValue([]);
});

describe("Alert history", () => {
  it("shows a push channel with nobody enrolled as a skipped channel, not a failure", async () => {
    await openHistory([
      warning({
        broadcastLogs: [
          log({ channelType: "push", status: "SKIPPED", targetCount: 0, deliveryCount: 0 }),
          log({ channelType: "sms" }),
        ],
      }),
    ]);

    fireEvent.click(screen.getByText("Flood warning"));

    expect(await screen.findByText("Push notification")).toBeTruthy();
    expect(screen.getByText("No receivers")).toBeTruthy();
    expect(
      screen.getByText("No phone in this district has notifications enabled")
    ).toBeTruthy();
    expect(screen.getByText("Open the citizen app once and allow notifications")).toBeTruthy();
    expect(screen.queryByText("Failed")).toBeNull();
    expect(screen.getByText("Nothing to send")).toBeTruthy();
  });

  it("summarises a mixed run as part notified rather than a failure", async () => {
    await openHistory([
      warning({
        broadcastLogs: [
          log({ channelType: "push", status: "SKIPPED", targetCount: 0, deliveryCount: 0 }),
          log({ channelType: "sms" }),
          log({ channelType: "siren", status: "SKIPPED", targetCount: 0, deliveryCount: 0 }),
        ],
      }),
    ]);

    expect(screen.getByText("Part notified")).toBeTruthy();
    expect(screen.queryByText("Delivery failure")).toBeNull();
  });

  it("calls a broadcast where every channel ran but none was enrolled an app inbox warning", async () => {
    await openHistory([
      warning({
        broadcastLogs: [
          log({ channelType: "push", status: "SKIPPED", targetCount: 0, deliveryCount: 0 }),
          log({ channelType: "siren", status: "SKIPPED", targetCount: 0, deliveryCount: 0 }),
        ],
      }),
    ]);

    expect(screen.getByText("App inbox only")).toBeTruthy();
  });

  it("still reports a real gateway rejection as a failure with the reason", async () => {
    await openHistory([
      warning({
        status: "STOOD_DOWN",
        broadcastLogs: [
          log({
            channelType: "push",
            status: "FAILED",
            targetCount: 4,
            deliveryCount: 0,
            failureCount: 4,
            errorMessage: "Expo: 400 ticket target is not a Expo push token",
          }),
        ],
      }),
    ]);

    fireEvent.click(screen.getByText("Flood warning"));

    expect(await screen.findByText("Failed")).toBeTruthy();
    expect(screen.getByText("Delivery failure")).toBeTruthy();
    expect(screen.getByText(/not a Expo push token/)).toBeTruthy();
    expect(screen.queryByText(/Next step/)).toBeNull();
  });

  it("keeps the count honest on a partially delivered channel", async () => {
    await openHistory([
      warning({
        broadcastLogs: [
          log({ channelType: "sms", status: "PARTIAL", targetCount: 4, deliveryCount: 1, failureCount: 3 }),
        ],
      }),
    ]);

    fireEvent.click(screen.getByText("Flood warning"));

    expect(await screen.findByText("Text and app inbox")).toBeTruthy();
    expect(screen.getAllByText("Part delivered")).toHaveLength(2);
    expect(screen.getByText("1 / 4")).toBeTruthy();
  });

  it("says so when a draft has never been broadcast", async () => {
    await openHistory([warning({ status: "DRAFT", broadcastLogs: [] })]);

    expect(screen.getByText("Not broadcast")).toBeTruthy();

    fireEvent.click(screen.getByText("Flood warning"));

    expect(await screen.findByText(/Nothing broadcast yet/)).toBeTruthy();
    expect(screen.getByText(/this warning is draft/i)).toBeTruthy();
  });

  it("lets the officer issue a warning from the draft row in history", async () => {
    wizardProps.length = 0;
    await openHistory([warning({ status: "DRAFT", broadcastLogs: [] })]);

    fireEvent.click(screen.getByText("Flood warning"));

    const actions = (await screen.findByText(/Saved but never sent/)).closest(
      ".dmc-detail-actions"
    ) as HTMLElement;

    fireEvent.click(within(actions).getByRole("button", { name: "Issue warning" }));

    expect(wizardProps[wizardProps.length - 1]?.initialWarningId).toBe("WARN-2026-0001");
  });
});

describe("Draft warnings on the overview", () => {
  beforeEach(() => {
    wizardProps.length = 0;
  });

  it("lists each waiting draft with its own way to send it", async () => {
    vi.mocked(fetchWarnings).mockResolvedValue([
      warning({ status: "DRAFT", broadcastLogs: [] }),
    ]);

    render(<DmcOfficerDashboard officer={officer} onLogout={vi.fn()} />);

    expect(await screen.findByText("1 draft warning waiting")).toBeTruthy();

    const card = screen.getByText("Saved").closest("article") as HTMLElement;

    fireEvent.click(within(card).getByRole("button", { name: "Issue warning" }));

    const opened = wizardProps[wizardProps.length - 1];

    expect(opened?.initialWarningId).toBe("WARN-2026-0001");
    expect(opened?.initialReportId).toBeUndefined();
  });

  it("keeps a blank new warning separate from the drafts waiting", async () => {
    vi.mocked(fetchWarnings).mockResolvedValue([
      warning({ status: "DRAFT", broadcastLogs: [] }),
    ]);

    render(<DmcOfficerDashboard officer={officer} onLogout={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "New warning" }));

    const opened = wizardProps[wizardProps.length - 1];

    expect(opened?.initialWarningId).toBeUndefined();
    expect(opened?.initialReportId).toBeUndefined();
  });
});
