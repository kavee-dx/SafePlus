import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ReportVerifyView from "../src/pages/amasha-ReportVerifyView";
import { requestMoreInfo } from "../src/services/amasha-reportApi";
import { AlertApiError, verifyReport } from "../src/services/dushani-alertApi";
import type { ExtendedReport } from "../src/services/amasha-reportApi";

vi.mock("../src/services/amasha-reportApi", () => ({
  requestMoreInfo: vi.fn(),
}));

vi.mock("../src/services/dushani-alertApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/dushani-alertApi")>();

  return { ...actual, verifyReport: vi.fn() };
});

const report = (overrides: Partial<ExtendedReport> = {}): ExtendedReport => ({
  id: "uuid-1",
  reportId: "RPT-LXK2A1-0007",
  reporterId: "citizen-9",
  reporterName: "Nimal Perera",
  hazardType: "FLOOD",
  severityLevel: "HIGH",
  locationDistrict: "Colombo",
  description: "Knee-deep water across the lane since last night.",
  immediateDanger: false,
  observedAt: "2026-10-01T04:00:00.000Z",
  status: "PENDING_VERIFICATION",
  attachments: [],
  createdAt: "2026-10-01T04:30:00.000Z",
  updatedAt: "2026-10-01T04:30:00.000Z",
  ...overrides,
});

function renderVerify(overrides: Partial<ExtendedReport> = {}) {
  const props = {
    onBack: vi.fn(),
    onDecided: vi.fn(),
  };

  render(<ReportVerifyView report={report(overrides)} {...props} />);

  return props;
}

const verifyChoice = () =>
  screen.getByRole("button", { name: /verify — the report is truthful/i });
const rejectChoice = () =>
  screen.getByRole("button", { name: /reject — cannot be confirmed/i });
const infoChoice = () =>
  screen.getByRole("button", { name: /request more information/i });
const submitButton = () => screen.getByRole("button", { name: /submit decision/i });

beforeEach(() => {
  vi.mocked(verifyReport).mockResolvedValue({} as never);
  vi.mocked(requestMoreInfo).mockResolvedValue({} as never);
});

describe("ReportVerifyView", () => {
  it("shows the ground truth the officer is verifying against", () => {
    renderVerify();

    expect(screen.getByText("Flood reported in Colombo")).toBeTruthy();
    expect(screen.getByText("RPT-LXK2A1-0007")).toBeTruthy();
    expect(
      screen.getByText("Knee-deep water across the lane since last night.")
    ).toBeTruthy();
    expect(screen.getByText("Nimal Perera")).toBeTruthy();
  });

  it("says when a report arrives with no evidence attached", () => {
    renderVerify();

    expect(screen.getByText(/no photo or video attached/i)).toBeTruthy();
  });

  it("keeps the decision locked until the officer picks one", () => {
    renderVerify();

    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(verifyChoice());

    expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it("returns to the report without recording anything on back", () => {
    const props = renderVerify();

    fireEvent.click(screen.getByRole("button", { name: /back to report/i }));

    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(verifyReport).not.toHaveBeenCalled();
  });

  it("verifies through the public RPT reference and tells the host it is done", async () => {
    const props = renderVerify();

    fireEvent.click(verifyChoice());
    await waitFor(() => fireEvent.click(submitButton()));

    await waitFor(() => expect(props.onDecided).toHaveBeenCalledTimes(1));

    expect(verifyReport).toHaveBeenCalledWith("RPT-LXK2A1-0007", "VERIFIED", undefined);
    expect(requestMoreInfo).not.toHaveBeenCalled();
  });

  it("refuses a rejection without a reason of at least ten characters", async () => {
    renderVerify();

    fireEvent.click(rejectChoice());
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);

    const reason = screen.getByLabelText(/reason for rejection/i);
    fireEvent.change(reason, { target: { value: "blurry" } });
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(reason, {
      target: { value: "The photo was taken somewhere else entirely." },
    });
    expect((submitButton() as HTMLButtonElement).disabled).toBe(false);

    await waitFor(() => fireEvent.click(submitButton()));

    await waitFor(() =>
      expect(verifyReport).toHaveBeenCalledWith(
        "RPT-LXK2A1-0007",
        "REJECTED",
        "The photo was taken somewhere else entirely."
      )
    );
    expect(requestMoreInfo).not.toHaveBeenCalled();
  });

  it("sends the request-for-information round trip to the internal uuid, not the RPT reference", async () => {
    renderVerify();

    fireEvent.click(infoChoice());
    fireEvent.change(screen.getByLabelText(/what more do you need\?/i), {
      target: { value: "Please add the nearest landmark." },
    });

    await waitFor(() => fireEvent.click(submitButton()));

    await waitFor(() =>
      expect(requestMoreInfo).toHaveBeenCalledWith("uuid-1", "Please add the nearest landmark.")
    );
    expect(verifyReport).not.toHaveBeenCalled();
  });

  it("surfaces the server's field complaint when the decision is bounced", async () => {
    renderVerify();

    vi.mocked(verifyReport).mockRejectedValueOnce(
      new AlertApiError(400, "Fix the highlighted fields before recording the decision.", {
        verificationNotes: "Notes are required when rejecting.",
      })
    );

    fireEvent.click(rejectChoice());
    fireEvent.change(screen.getByLabelText(/reason for rejection/i), {
      target: { value: "The photo was taken somewhere else entirely." },
    });

    await waitFor(() => fireEvent.click(submitButton()));

    await waitFor(() =>
      expect(screen.getByText("Notes are required when rejecting.")).toBeTruthy()
    );
  });
});
