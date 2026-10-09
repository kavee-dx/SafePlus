import { render, screen, userEvent, waitFor } from "@testing-library/react-native";

import AlertInboxScreen from "./dushani-AlertInboxScreen";
import { AlertApiError, fetchAlertInbox, markAlertRead } from "../services/dushani-alertApi";
import type { DeliveredAlert } from "../services/dushani-alertApi";

jest.mock("../services/dushani-alertApi", () => {
  class AlertApiError extends Error {
    readonly status: number | null;
    readonly fieldErrors: Record<string, string>;

    constructor(
      message: string,
      status: number | null = null,
      fieldErrors: Record<string, string> = {}
    ) {
      super(message);
      this.name = "AlertApiError";
      this.status = status;
      this.fieldErrors = fieldErrors;
    }
  }

  return {
    AlertApiError,
    fetchAlertInbox: jest.fn(),
    markAlertRead: jest.fn(),
    saveAlertTarget: jest.fn(),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
}));

const alert = (overrides: Partial<DeliveredAlert> = {}): DeliveredAlert => ({
  id: "a-1",
  warningId: "WARN-2026-0007",
  senderId: "DMC",
  levelLabel: "Level 3 - Immediate Evacuation",
  areaLabel: "Colombo District",
  instruction: "Move to higher ground now.",
  body: "SAFEPLUS ALERT Level 3 - Immediate Evacuation. Move to higher ground now.",
  englishMessage: "Move to higher ground now.",
  sinhalaMessage: "  වහාම ඉහළ බිමට යන්න.  ",
  tamilMessage: "உடனே உயர் இடத்திற்கு செல்லவும்.",
  deliveredAt: "2026-10-09T08:00:00.000Z",
  warningStatus: "ACTIVE",
  hazardType: "FLOOD",
  severityLevel: "CRITICAL",
  targetDistrict: "Colombo",
  expiresAt: "2026-10-09T14:00:00.000Z",
  ...overrides,
});

function load(alerts: DeliveredAlert[]) {
  jest.mocked(fetchAlertInbox).mockResolvedValue({
    alerts,
    unreadCount: alerts.filter((item) => !item.readAt).length,
  });
  jest.mocked(markAlertRead).mockResolvedValue(undefined);
}

function renderInbox(items: DeliveredAlert[]) {
  load(items);

  return (
    <AlertInboxScreen
      token="token-abc"
      pushState="ready"
      pushReason={null}
      onBack={jest.fn()}
    />
  );
}

describe("AlertInboxScreen", () => {
  it("says it is checking rather than showing an empty inbox", async () => {
    jest.mocked(fetchAlertInbox).mockReturnValue(new Promise(() => {}));

    render(<AlertInboxScreen token="t" pushState="ready" onBack={jest.fn()} />);

    await waitFor(() => expect(screen.getByText("Checking")).toBeTruthy());

    expect(screen.queryByText("Emergency alert")).toBeNull();
  });

  it("lays a delivered broadcast out the way the storyboard prints it", async () => {
    render(renderInbox([alert()]));

    await waitFor(() => expect(screen.getByText("Emergency alert")).toBeTruthy());

    expect(screen.getByText("DMC national warning service")).toBeTruthy();
    expect(screen.getByText("Level 3 - Immediate Evacuation")).toBeTruthy();
    expect(screen.getByText("Colombo District")).toBeTruthy();
    expect(screen.getByText("Move to higher ground now.")).toBeTruthy();
    expect(screen.getByText("Posted")).toBeTruthy();
    expect(screen.getByText("Active until")).toBeTruthy();
    expect(screen.getByText("Still active")).toBeTruthy();
    expect(screen.getByText("WARN-2026-0007")).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
    expect(fetchAlertInbox).toHaveBeenCalledWith("token-abc");
  });

  it("counts what arrived and what is still waiting to be read", async () => {
    render(
      renderInbox([
        alert(),
        alert({ id: "a-2", warningId: "WARN-2026-0008", readAt: "2026-10-08T09:00:00.000Z" }),
      ])
    );

    await waitFor(() => expect(screen.getByText(/2 warnings delivered/)).toBeTruthy());

    expect(screen.getByText(/1 of 2/)).toBeTruthy();
    expect(screen.getByText("Tap a card to expand it")).toBeTruthy();
  });

  it("opens the three scripts and marks the text read on the way", async () => {
    render(renderInbox([alert()]));

    await waitFor(() => expect(screen.getByText("Emergency alert")).toBeTruthy());

    const user = userEvent.setup();
    await user.press(screen.getByLabelText("Show the full message"));

    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("Sinhala")).toBeTruthy();
    expect(screen.getByText("Tamil")).toBeTruthy();
    expect(screen.getByText("වහාම ඉහළ බිමට යන්න.")).toBeTruthy();

    await waitFor(() => expect(markAlertRead).toHaveBeenCalledWith("token-abc", "a-1"));
    await waitFor(() => expect(screen.queryByText("New")).toBeNull());

    expect(screen.getByText("Every message read here")).toBeTruthy();
    expect(screen.getByLabelText("Hide the full message")).toBeTruthy();
  });

  it("prints the single body when a warning was sent without translations", async () => {
    render(
      renderInbox([
        alert({
          englishMessage: "",
          sinhalaMessage: "   ",
          tamilMessage: undefined,
          body: "Kalutara District: stay away from the shoreline.",
        }),
      ])
    );

    await waitFor(() => expect(screen.getByText("Emergency alert")).toBeTruthy());

    const user = userEvent.setup();
    await user.press(screen.getByLabelText("Show the full message"));

    expect(screen.getByText("Message")).toBeTruthy();
    expect(screen.getByText("Kalutara District: stay away from the shoreline.")).toBeTruthy();
    expect(markAlertRead).toHaveBeenCalled();
  });

  it("marks a stood-down warning as history instead of an active order", async () => {
    render(
      renderInbox([
        alert({
          warningStatus: "STOOD_DOWN",
          readAt: "2026-10-09T09:00:00.000Z",
          expiresAt: undefined,
        }),
      ])
    );

    await waitFor(() => expect(screen.getByText("Emergency alert")).toBeTruthy());

    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.getByText("Stood down")).toBeTruthy();
    expect(screen.getByText("No end time set")).toBeTruthy();
    expect(screen.queryByText("Still active")).toBeNull();
    expect(screen.queryByText("New")).toBeNull();
  });

  it("explains that alerts still land in the inbox when push is blocked", async () => {
    load([]);

    render(
      <AlertInboxScreen
        token="token-abc"
        pushState="blocked"
        pushReason="This phone refused notification permission."
        onBack={jest.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText("No alerts received")).toBeTruthy());

    expect(screen.getByText("Push is off for this phone")).toBeTruthy();
    expect(screen.getByText("This phone refused notification permission.")).toBeTruthy();
    expect(
      screen.getByText(
        "Alerts still arrive here within about twenty seconds of a broadcast."
      )
    ).toBeTruthy();
  });

  it("keeps the server's own words when the inbox cannot be read", async () => {
    jest
      .mocked(fetchAlertInbox)
      .mockRejectedValue(new AlertApiError("Sign in again to read your alerts.", 401));

    render(<AlertInboxScreen token="token-abc" pushState="ready" onBack={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText("Sign in again to read your alerts.")).toBeTruthy()
    );

    expect(screen.queryByText("Checking")).toBeNull();
    expect(screen.queryByText("No alerts received")).toBeNull();
  });

  it("falls back to a plain sentence when the failure is not one of ours", async () => {
    jest.mocked(fetchAlertInbox).mockRejectedValue(new Error("Boom."));

    render(<AlertInboxScreen token="token-abc" pushState="ready" onBack={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText("Your alerts could not load.")).toBeTruthy()
    );
  });

  it("says plainly that no shelters were published with the warning", async () => {
    render(renderInbox([alert()]));

    await waitFor(() => expect(screen.getByText("Emergency alert")).toBeTruthy());

    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: "View designated shelters" }));

    expect(screen.getByText("Designated shelters")).toBeTruthy();
    expect(screen.getAllByText("Colombo District")).toHaveLength(2);
    expect(
      screen.getByText(/No shelter names were published with this warning/)
    ).toBeTruthy();
  });
});
