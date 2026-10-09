import { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchNotifications, markNotificationRead } from "../services/dushani-alertApi";
import type { PortalNotification } from "../types/hazardReport";
import NotificationBell from "./dushani-NotificationBell";

vi.mock("../services/dushani-alertApi", () => ({
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

const notification = (overrides: Partial<PortalNotification> = {}): PortalNotification => ({
  id: "n-1",
  recipientId: "officer-1",
  type: "REPORT_VERIFIED",
  title: "Report verified",
  message: "A flood report in Colombo is ready for a warning.",
  isRead: false,
  createdAt: "2026-10-09T08:15:00.000Z",
  ...overrides,
});

const loaded = (items: PortalNotification[], unreadCount = items.filter((i) => !i.isRead).length) =>
  vi.mocked(fetchNotifications).mockResolvedValue({ notifications: items, unreadCount });

async function openBell() {
  fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
  await waitFor(() => expect(screen.getByText("Notifications")).toBeTruthy());
}

beforeEach(() => {
  vi.mocked(markNotificationRead).mockResolvedValue(undefined);
});

describe("NotificationBell", () => {
  it("keeps the list hidden until the officer opens it", async () => {
    loaded([]);
    render(<NotificationBell />);

    await waitFor(() => expect(fetchNotifications).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Notifications")).toBeNull();
  });

  it("counts unread alerts on the badge and says so in the label", async () => {
    loaded([notification(), notification({ id: "n-2", isRead: true })], 1);
    render(<NotificationBell />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy()
    );
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("caps the badge at 9+ rather than showing a three digit blob", async () => {
    loaded(
      Array.from({ length: 12 }, (_, index) => notification({ id: `n-${index}` })),
      12
    );
    render(<NotificationBell />);

    await waitFor(() => expect(screen.getByText("9+")).toBeTruthy());
  });

  it("tells the officer where a verified report comes from when nothing has arrived", async () => {
    loaded([]);
    render(<NotificationBell />);
    await openBell();

    expect(screen.getByText(/Nothing yet/i).textContent).toMatch(/verified/);
  });

  it("surfaces a load failure instead of showing a false empty list", async () => {
    vi.mocked(fetchNotifications).mockRejectedValue(new Error("Session expired."));
    render(<NotificationBell />);
    await openBell();

    expect(screen.getByText("Session expired.")).toBeTruthy();
    expect(screen.queryByText(/Nothing yet/i)).toBeNull();
  });

  it("marks a report alert read and takes the officer to the queue", async () => {
    const onOpenReports = vi.fn();
    loaded([notification()]);
    render(<NotificationBell onOpenReports={onOpenReports} />);
    await openBell();

    fireEvent.click(screen.getByText("Report verified"));

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith("n-1"));
    expect(onOpenReports).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Notifications")).toBeNull();
  });

  it("leaves the panel open for a warning alert, which belongs to the dashboard", async () => {
    const onOpenReports = vi.fn();
    loaded([notification({ id: "n-9", type: "WARNING_CREATED", isRead: true })]);
    render(<NotificationBell onOpenReports={onOpenReports} />);
    await openBell();

    fireEvent.click(screen.getByText("Report verified"));

    await waitFor(() => expect(markNotificationRead).not.toHaveBeenCalled());
    expect(onOpenReports).not.toHaveBeenCalled();
    expect(screen.getByText("Notifications")).toBeTruthy();
  });

  it("pulls a fresh page when the officer hits refresh", async () => {
    loaded([notification()]);
    render(<NotificationBell />);
    await openBell();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(fetchNotifications).toHaveBeenCalledTimes(2));
  });

  it("polls on its own so a report verified minutes ago still arrives", async () => {
    vi.useFakeTimers();
    try {
      loaded([notification()]);
      render(<NotificationBell />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      expect(fetchNotifications).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
