import {
  subscribeDispatchEvents,
  publishDispatchEvent,
  dispatchEventSubscriberCount,
} from "../services/kaveesha-dispatchEvents";

describe("subscribeDispatchEvents / publishDispatchEvent", () => {
  it("delivers an event to a matching district and stamps the time", () => {
    const seen: { kind: string; at: string }[] = [];
    const off = subscribeDispatchEvents("Colombo", (event) => seen.push(event as never));

    publishDispatchEvent({ kind: "dispatch", district: "Colombo", message: "team en route" });

    expect(seen).toHaveLength(1);
    expect(seen[0].kind).toBe("dispatch");
    expect(typeof seen[0].at).toBe("string");
    expect(Number.isNaN(Date.parse(seen[0].at))).toBe(false);

    off();
  });

  it("does not deliver to a different district", () => {
    const seen: unknown[] = [];
    const off = subscribeDispatchEvents("Kandy", (event) => seen.push(event));

    publishDispatchEvent({ kind: "dispatch", district: "Colombo", message: "elsewhere" });

    expect(seen).toHaveLength(0);
    off();
  });

  it("sends every district to a wildcard subscriber", () => {
    const seen: string[] = [];
    const off = subscribeDispatchEvents(null, (event) => seen.push(event.district));

    publishDispatchEvent({ kind: "dispatch", district: "Colombo", message: "a" });
    publishDispatchEvent({ kind: "incident", district: "Galle", message: "b" });

    expect(seen).toEqual(["Colombo", "Galle"]);
    off();
  });

  it("stops delivering once unsubscribed", () => {
    const seen: unknown[] = [];
    const off = subscribeDispatchEvents("Matara", (event) => seen.push(event));

    off();
    publishDispatchEvent({ kind: "dispatch", district: "Matara", message: "late" });

    expect(seen).toHaveLength(0);
  });

  it("keeps other subscribers alive when one throws", () => {
    const seen: unknown[] = [];
    const bad = subscribeDispatchEvents("Jaffna", () => {
      throw new Error("dead socket");
    });
    const good = subscribeDispatchEvents("Jaffna", (event) => seen.push(event));

    expect(() =>
      publishDispatchEvent({ kind: "shelter", district: "Jaffna", message: "capacity" })
    ).not.toThrow();
    expect(seen).toHaveLength(1);

    bad();
    good();
  });

  it("lets one district hold two independent boards", () => {
    const a: unknown[] = [];
    const b: unknown[] = [];
    const offA = subscribeDispatchEvents("Negombo", (event) => a.push(event));
    const offB = subscribeDispatchEvents("Negombo", (event) => b.push(event));

    publishDispatchEvent({ kind: "dispatch", district: "Negombo", message: "both" });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);

    offA();
    offB();
  });
});

describe("dispatchEventSubscriberCount", () => {
  it("counts open subscriptions and drops back after unsubscribing", () => {
    const before = dispatchEventSubscriberCount();
    const off = subscribeDispatchEvents("Anuradhapura", () => undefined);

    expect(dispatchEventSubscriberCount()).toBe(before + 1);

    off();
    expect(dispatchEventSubscriberCount()).toBe(before);
  });
});
