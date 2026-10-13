import { fireEvent, render, waitFor } from "@testing-library/react-native";

import MyDeliveriesScreen from "./dildhara-MyDeliveriesScreen";
import {
  DeliveryApiError,
  fetchMyDeliveries,
} from "../services/dildhara-deliveriesApi";
import RoleHome from "./amasha-RoleHome";
import type { Profile } from "../services/dildhara-profileApi";

jest.mock("../services/dildhara-deliveriesApi", () => ({
  fetchMyDeliveries: jest.fn(),
  DeliveryApiError: class DeliveryApiError extends Error {
    status: number | null;

    constructor(message: string, status: number | null) {
      super(message);
      this.status = status;
    }
  },
}));

const fetchMock = jest.mocked(fetchMyDeliveries);

const assignment = {
  assignmentId: "assignment-1",
  tripNumber: 2,
  assignmentStatus: "EN_ROUTE",
  assignmentNotes: "Call the receiving centre before arrival.",
  dispatchId: "dispatch-1",
  dispatchStatus: "IN_TRANSIT",
  agencyResponse: "ACCEPTED",
  plannedDeparture: "2026-10-12T08:00:00.000Z",
  actualDeparture: "2026-10-12T08:15:00.000Z",
  destinationName: "North Relief Centre",
  destinationLocation: "Main Street, Jaffna",
  destinationDistrict: "Jaffna",
  driverName: "Volunteer One",
  volunteerName: "Volunteer One",
  teamName: null,
  items: [
    {
      id: "item-1",
      resourceName: "Drinking water",
      resourceType: "Drinking Water",
      pickupLocation: "Provider warehouse",
      pickupDistrict: "Colombo",
      quantityDispatched: "24",
      quantityReceived: null,
      quantityDamaged: "0",
      quantityMissing: "0",
      unit: "Bottles",
    },
  ],
};

const teamProfile: Profile = {
  user: {
    id: "team-account",
    fullName: "Team Leader",
    email: "team@example.com",
    username: "team.leader",
    phoneNumber: null,
    nicNumber: null,
    dateOfBirth: null,
    gender: null,
    address: null,
    city: null,
    district: null,
    postalCode: null,
    role: "DELIVERY_VOLUNTEER_TEAM",
    status: "ACTIVE",
  },
  details: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("delivery-role home navigation", () => {
  it("opens the team delivery action instead of unrelated request/assign actions", async () => {
    const onAction = jest.fn();
    const view = await render(
      <RoleHome
        profile={teamProfile}
        onOpenProfile={jest.fn()}
        onAction={onAction}
      />
    );

    fireEvent.press(view.getByText("Team deliveries"));

    expect(onAction).toHaveBeenCalledWith("my-deliveries");
    expect(view.queryByText("Requests")).toBeNull();
    expect(view.queryByText("Assign")).toBeNull();
  });
});

describe("My Deliveries screen", () => {
  it("shows a clear empty state and refreshes data from the backend", async () => {
    fetchMock.mockResolvedValue([]);
    const view = await render(
      <MyDeliveriesScreen
        token="delivery-token"
        onBack={jest.fn()}
        onSessionExpired={jest.fn()}
      />
    );

    expect(await view.findByText("No deliveries assigned yet")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Refresh deliveries"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledWith("delivery-token");
  });

  it("shows dispatch, trip, destination and item quantities when a trip opens", async () => {
    fetchMock.mockResolvedValue([assignment]);
    const view = await render(
      <MyDeliveriesScreen
        token="delivery-token"
        onBack={jest.fn()}
        onSessionExpired={jest.fn()}
      />
    );

    const delivery = await view.findByText("North Relief Centre");
    fireEvent.press(delivery);

    expect(await view.findByText(/Main Street, Jaffna/)).toBeTruthy();
    expect(view.getByText("Drinking water · 24 Bottles")).toBeTruthy();
    expect(view.getByText("Pickup: Provider warehouse · Colombo")).toBeTruthy();
    expect(view.getByText(/Trip: en route/)).toBeTruthy();
    expect(view.getByText(/Dispatch: in transit/)).toBeTruthy();
  });

  it("signs out when the assignments API reports an expired session", async () => {
    const onSessionExpired = jest.fn();
    fetchMock.mockRejectedValue(
      new DeliveryApiError("Session expired. Please sign in again.", 401)
    );

    await render(
      <MyDeliveriesScreen
        token="expired-token"
        onBack={jest.fn()}
        onSessionExpired={onSessionExpired}
      />
    );

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));
  });

  it("shows a backend error and allows the user to retry", async () => {
    fetchMock
      .mockRejectedValueOnce(new DeliveryApiError("Dispatch service unavailable.", 503))
      .mockResolvedValueOnce([]);

    const view = await render(
      <MyDeliveriesScreen
        token="delivery-token"
        onBack={jest.fn()}
        onSessionExpired={jest.fn()}
      />
    );

    expect(await view.findByText("Dispatch service unavailable.")).toBeTruthy();
    fireEvent.press(view.getByText("Try again"));

    expect(await view.findByText("No deliveries assigned yet")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
