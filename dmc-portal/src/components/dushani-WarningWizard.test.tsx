import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchVerifiedReports,
  fetchWarning,
  fetchWarnings,
  previewAudience,
} from "../services/dushani-alertApi";
import type { HazardReport } from "../types/hazardReport";
import type { AudiencePreview, DisasterWarning } from "../types/warning";
import WarningWizard from "./dushani-WarningWizard";

vi.mock("../services/dushani-alertApi", () => {
  class AlertApiError extends Error {
    readonly status: number;
    readonly fieldErrors: Record<string, string>;

    constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
      super(message);
      this.name = "AlertApiError";
      this.status = status;
      this.fieldErrors = fieldErrors;
    }
  }

  return {
    AlertApiError,
    broadcastWarning: vi.fn(),
    createDraft: vi.fn(),
    extendWarningExpiry: vi.fn(),
    fetchDistricts: vi.fn().mockResolvedValue([]),
    fetchDistrictRings: vi.fn().mockResolvedValue([]),
    fetchVerifiedReports: vi.fn(),
    fetchWarning: vi.fn(),
    fetchWarnings: vi.fn(),
    pinProblem: (failure: unknown) =>
      failure instanceof Error ? failure.message : "Problem.",
    previewAudience: vi.fn(),
    standDownWarning: vi.fn(),
    synthesizeMessages: vi.fn(),
    updateDraft: vi.fn(),
  };
});

// The map draws SVG from real boundary rings; the wizard's steps are under test.
vi.mock("./dushani-TargetMap", () => ({ default: () => null }));

const report = (overrides: Partial<HazardReport> = {}): HazardReport => ({
  id: "r-1",
  reportId: "RPT-0001",
  reporterName: "Kamal Perera",
  hazardType: "FLOOD",
  severityLevel: "HIGH",
  locationDistrict: "Colombo",
  description: "Water is rising fast in Borugedikada.",
  status: "VERIFIED",
  warningCount: 0,
  createdAt: "2026-10-09T07:00:00.000Z",
  updatedAt: "2026-10-09T07:10:00.000Z",
  ...overrides,
});

const draft = (overrides: Partial<DisasterWarning> = {}): DisasterWarning => ({
  id: "w-1",
  warningId: "WARN-2026-0009",
  reportId: "r-1",
  report: report(),
  hazardType: "FLOOD",
  severityLevel: "HIGH",
  targetDistrict: "Colombo",
  status: "DRAFT",
  englishMessage: "Move to higher ground in Colombo now.",
  sinhalaMessage: "කොළඹ ඉහළ බිමට යන්න.",
  tamilMessage: "கொழும்பில் உயர் இடத்திற்கு செல்லவும்.",
  channels: { push: true, sms: true, siren: false },
  officerId: "officer-1",
  audienceCount: 12,
  smsRecipientCount: 3,
  expiresInHours: 24,
  createdAt: "2026-10-09T08:00:00.000Z",
  updatedAt: "2026-10-09T08:05:00.000Z",
  ...overrides,
});

const audience: AudiencePreview = {
  targetDistrict: "Colombo",
  registeredResidents: 12,
  pushCapable: 9,
  smsCapable: 3,
  outsideBoundary: 0,
  audienceCount: 12,
  hasCustomBoundary: false,
  canBroadcast: true,
};

beforeEach(() => {
  vi.mocked(fetchVerifiedReports).mockResolvedValue([report()]);
  vi.mocked(fetchWarnings).mockResolvedValue([]);
  vi.mocked(previewAudience).mockResolvedValue(audience);
});

describe("Warning wizard drafts", () => {
  it("keeps a report with an unsent draft open instead of blocking it", async () => {
    vi.mocked(fetchWarnings).mockResolvedValue([draft()]);
    vi.mocked(fetchVerifiedReports).mockResolvedValue([report({ warningCount: 1 })]);

    render(<WarningWizard onExit={vi.fn()} onSetupPin={vi.fn()} onViewHistory={vi.fn()} />);

    const pill = await screen.findByText("Draft waiting for PIN");

    expect(screen.queryByText(/already carries a warning/)).toBeNull();
    expect(pill.closest("button")?.hasAttribute("disabled")).toBe(false);
  });

  it("leaves a report whose warning is already issued closed in step 1", async () => {
    vi.mocked(fetchVerifiedReports).mockResolvedValue([
      report({ warningCount: 1 }),
      report({
        id: "r-2",
        reportId: "RPT-0002",
        hazardType: "LANDSLIDE",
        description: "A slope moved near the road.",
      }),
    ]);

    render(<WarningWizard onExit={vi.fn()} onSetupPin={vi.fn()} onViewHistory={vi.fn()} />);

    const pill = await screen.findByText("Already alerted");

    expect(pill.closest("button")?.hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText("Draft waiting for PIN")).toBeNull();
  });

  it("opens a saved draft straight onto the clearance PIN step", async () => {
    vi.mocked(fetchWarnings).mockResolvedValue([draft()]);
    vi.mocked(fetchVerifiedReports).mockResolvedValue([report({ warningCount: 1 })]);

    render(<WarningWizard onExit={vi.fn()} onSetupPin={vi.fn()} onViewHistory={vi.fn()} />);

    fireEvent.click((await screen.findByText("Draft waiting for PIN")).closest("button")!);

    expect(await screen.findByText("Authorize the broadcast")).toBeTruthy();
    expect(screen.getByText("WARN-2026-0009")).toBeTruthy();
    expect(screen.getByText("RPT-0001")).toBeTruthy();
  });

  it("resumes a draft it was handed without walking the officer back through it", async () => {
    vi.mocked(fetchWarning).mockResolvedValue(draft());

    render(
      <WarningWizard
        initialWarningId="WARN-2026-0009"
        onExit={vi.fn()}
        onSetupPin={vi.fn()}
        onViewHistory={vi.fn()}
      />
    );

    expect(await screen.findByText("Authorize the broadcast")).toBeTruthy();
    expect(screen.getByText("Whole district")).toBeTruthy();
    expect(previewAudience).toHaveBeenCalledWith("Colombo", undefined);
  });

  it("resumes a drawn boundary as a drawn boundary", async () => {
    vi.mocked(fetchWarning).mockResolvedValue(
      draft({
        gisPolygon: {
          id: "p-1",
          warningId: "WARN-2026-0009",
          source: "CUSTOM",
          coordinates: [
            { lat: 6.9, lng: 79.85 },
            { lat: 6.95, lng: 79.85 },
            { lat: 6.95, lng: 79.9 },
            { lat: 6.9, lng: 79.9 },
            { lat: 6.9, lng: 79.85 },
          ],
          areaSqKm: 12.4,
          isValid: true,
          createdAt: "2026-10-09T08:00:00.000Z",
        },
      })
    );

    render(
      <WarningWizard
        initialWarningId="WARN-2026-0009"
        onExit={vi.fn()}
        onSetupPin={vi.fn()}
        onViewHistory={vi.fn()}
      />
    );

    await screen.findByText("Authorize the broadcast");

    expect(screen.getByText("Drawn polygon")).toBeTruthy();
    expect(previewAudience).toHaveBeenCalledWith(
      "Colombo",
      expect.arrayContaining([expect.objectContaining({ lat: 6.9 })])
    );
    expect(vi.mocked(previewAudience).mock.calls[0]?.[1]).toHaveLength(5);
  });

  it("still refuses a report whose warning has already gone out", async () => {
    vi.mocked(fetchVerifiedReports).mockResolvedValue([
      report({ warningCount: 1 }),
    ]);

    render(
      <WarningWizard
        initialReportId="r-1"
        onExit={vi.fn()}
        onSetupPin={vi.fn()}
        onViewHistory={vi.fn()}
      />
    );

    expect(await screen.findByText(/already carries a warning/)).toBeTruthy();
    expect(screen.queryByText("Authorize the broadcast")).toBeNull();
  });

  it("says so when a reopened warning is no longer a draft", async () => {
    vi.mocked(fetchWarning).mockResolvedValue(draft({ status: "ACTIVE" }));

    render(
      <WarningWizard
        initialWarningId="WARN-2026-0009"
        onExit={vi.fn()}
        onSetupPin={vi.fn()}
        onViewHistory={vi.fn()}
      />
    );

    expect(
      await screen.findByText("Warning WARN-2026-0009 is active and can no longer be edited.")
    ).toBeTruthy();
    expect(screen.queryByText("Authorize the broadcast")).toBeNull();
  });
});
