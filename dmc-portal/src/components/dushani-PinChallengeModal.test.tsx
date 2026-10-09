import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PinChallengeModal from "./dushani-PinChallengeModal";

const digits = () => screen.getAllByLabelText(/Clearance PIN digit/);

function renderModal(overrides: Partial<Parameters<typeof PinChallengeModal>[0]> = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();

  render(
    <PinChallengeModal
      title="Extend the warning"
      description="Enter your clearance PIN."
      confirmLabel="Extend"
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...overrides}
    />
  );

  return { onCancel, onConfirm };
}

function type(value: string) {
  const boxes = digits();

  value.split("").forEach((character, index) => {
    fireEvent.change(boxes[index], { target: { value: character } });
  });
}

function paste(value: string) {
  const event = new Event("paste", { bubbles: true }) as Event & {
    clipboardData: { getData: (format: string) => string };
  };
  event.clipboardData = { getData: () => value };

  fireEvent(digits()[0], event);
}

describe("PinChallengeModal", () => {
  it("shows the officer why the action is being gated", () => {
    renderModal();

    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Extend the warning")).toBeTruthy();
    expect(screen.getByText("Enter your clearance PIN.")).toBeTruthy();
    expect(digits()).toHaveLength(6);
  });

  it("keeps the confirm button dead until all six digits are in", () => {
    const { onConfirm } = renderModal();
    const confirm = screen.getByRole("button", { name: "Extend" });

    expect(confirm.hasAttribute("disabled")).toBe(true);

    type("2481");
    expect(screen.getByRole("button", { name: "Extend" }).hasAttribute("disabled")).toBe(
      true
    );

    type("248153");
    fireEvent.click(screen.getByRole("button", { name: "Extend" }));
    expect(onConfirm).toHaveBeenCalledWith("248153");
  });

  it("refuses to put a letter in a numeric box", () => {
    renderModal();

    fireEvent.change(digits()[0], { target: { value: "a" } });

    expect((digits()[0] as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Extend" }).hasAttribute("disabled")).toBe(
      true
    );
  });

  it("keeps only the last character typed into one box", () => {
    renderModal();

    fireEvent.change(digits()[0], { target: { value: "47" } });

    expect((digits()[0] as HTMLInputElement).value).toBe("7");
  });

  it("fills the whole PIN from a paste and drops the spare digits", () => {
    renderModal();

    paste("12 345 6789");

    expect(digits().map((box) => (box as HTMLInputElement).value).join("")).toBe("123456");
  });

  it("sends the PIN on Enter once it is complete", () => {
    const { onConfirm } = renderModal();

    type("904112");
    fireEvent.keyDown(digits()[5], { key: "Enter" });

    expect(onConfirm).toHaveBeenCalledWith("904112");
  });

  it("does not send an incomplete PIN on Enter", () => {
    const { onConfirm } = renderModal();

    type("904");
    fireEvent.keyDown(digits()[2], { key: "Enter" });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("wipes the boxes and explains itself when the server rejects the PIN", () => {
    renderModal({ error: "That PIN is not recognised." });

    expect(screen.getByText("That PIN is not recognised.")).toBeTruthy();
    expect(digits().map((box) => (box as HTMLInputElement).value).join("")).toBe("");
    expect(screen.getByRole("button", { name: "Extend" }).hasAttribute("disabled")).toBe(
      true
    );
  });

  it("lets Escape out of the dialog", () => {
    const { onCancel } = renderModal();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("holds the dialog shut while a broadcast is already in flight", () => {
    const { onCancel } = renderModal({ busy: true });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(
      true
    );
  });
});
