import { fireEvent, render, waitFor } from "@testing-library/react-native";

import RequestResourceScreen from "../src/screens/dildhara-RequestResourceScreen";
import {
  createResourceRequest,
  ResourceRequestApiError,
} from "../src/services/dildhara-resourceRequestApi";

jest.mock("../src/services/dildhara-resourceRequestApi", () => ({
  createResourceRequest: jest.fn(),
  ResourceRequestApiError: class ResourceRequestApiError extends Error {
    status?: number;

    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  },
}));

const createRequestMock = jest.mocked(createResourceRequest);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("citizen resource request supporting relief operations", () => {
  it("validates required fields before making a request", async () => {
    const view = await render(
      <RequestResourceScreen
        token="citizen-token"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
        onSessionExpired={jest.fn()}
      />
    );

    await fireEvent.changeText(view.getByPlaceholderText("Example: Drinking water"), "Bottled water");
    await fireEvent.changeText(view.getByPlaceholderText("Example: 100"), "0");
    await fireEvent.press(view.getByText("Submit Request"));

    expect(await view.findByText("Quantity must be a positive whole number.")).toBeTruthy();
    expect(createRequestMock).not.toHaveBeenCalled();
  });

  it("submits the citizen request data and reports success to the host screen", async () => {
    const onSuccess = jest.fn();
    createRequestMock.mockResolvedValue({
      id: "66666666-6666-4666-8666-666666666666",
      requesterUserId: "77777777-7777-4777-8777-777777777777",
      resourceType: "Drinking Water",
      resourceName: "Bottled water",
      description: "Needed for families at the school shelter.",
      quantity: 24,
      unit: "Litres",
      urgency: "CRITICAL",
      requiredDate: null,
      location: "North Relief Centre",
      district: "Jaffna",
      status: "PENDING",
      createdAt: "2026-10-01T08:00:00.000Z",
      updatedAt: "2026-10-01T08:00:00.000Z",
    });
    const view = await render(
      <RequestResourceScreen
        token="citizen-token"
        onSuccess={onSuccess}
        onCancel={jest.fn()}
        onSessionExpired={jest.fn()}
      />
    );

    await fireEvent.changeText(view.getByPlaceholderText("Example: Drinking water"), "Bottled water");
    await fireEvent.changeText(view.getByPlaceholderText("Example: 100"), "24");
    await fireEvent.press(view.getByText("Litres"));
    await fireEvent.press(view.getByText("CRITICAL"));
    await fireEvent.changeText(view.getByPlaceholderText("Example: Colombo"), "Jaffna");
    await fireEvent.changeText(
      view.getByPlaceholderText(/Galle General Hospital/),
      "North Relief Centre"
    );
    await fireEvent.changeText(
      view.getByPlaceholderText("Explain why this resource is needed..."),
      "Needed for families at the school shelter."
    );

    await fireEvent.press(view.getByText("Submit Request"));

    await waitFor(() => expect(createRequestMock).toHaveBeenCalledWith(
      "citizen-token",
      expect.objectContaining({
        resourceType: "Drinking Water",
        resourceName: "Bottled water",
        quantity: 24,
        unit: "Litres",
        urgency: "CRITICAL",
        location: "North Relief Centre",
        district: "Jaffna",
      })
    ));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("notifies the host when the request API reports an expired session", async () => {
    const onSessionExpired = jest.fn();
    createRequestMock.mockRejectedValue(new ResourceRequestApiError("Please sign in again.", 401));
    const view = await render(
      <RequestResourceScreen
        token="expired-token"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
        onSessionExpired={onSessionExpired}
      />
    );

    await fireEvent.changeText(view.getByPlaceholderText("Example: Drinking water"), "Bottled water");
    await fireEvent.changeText(view.getByPlaceholderText("Example: 100"), "24");
    await fireEvent.changeText(view.getByPlaceholderText("Example: Colombo"), "Jaffna");
    await fireEvent.changeText(
      view.getByPlaceholderText(/Galle General Hospital/),
      "North Relief Centre"
    );
    await fireEvent.press(view.getByText("Submit Request"));

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));
  });
});
