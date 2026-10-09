import type { DispatchStatus } from "../models/kaveesha-rescueDispatch";

/* ------------------------------------------------------------------ *
 * The live feed of UC-03.
 *
 * Every mission stage and every incident closure is published here the moment
 * it is written, and the officer's board is subscribed to its own district.
 * That is the whole design: the database stays the only truth, and this bus is
 * just a notification that something changed, so a client that missed an event
 * still reads correct data on its next poll.
 *
 * In-process on purpose. One API instance serves this deployment, and a bus
 * that crossed processes would need Redis before it was worth the ops cost.
 * ------------------------------------------------------------------ */

export interface DispatchLiveEvent {
  /** What moved, so the board knows which card to re-read. */
  kind: "dispatch" | "incident" | "shelter";
  /** Always the incident district, even for a mutual-aid team. */
  district: string;
  /** The printed RPT- code, which is what the desk keys its rows on. A shelter
   *  event has no incident, so it is absent there. */
  reportId?: string;
  dispatchCode?: string;
  teamName?: string;
  /** The mission stage, or "CLOSED" for an incident closure. */
  status?: DispatchStatus | "CLOSED" | "REOPENED";
  /** Set for a shelter event, so the shelter board knows what to re-read. */
  shelterId?: string;
  groupCode?: string;
  /** Written to be shown as-is: a toast that needs another lookup is a lag. */
  message: string;
  at: string;
}

type Listener = (event: DispatchLiveEvent) => void;

/**
 * Subscribers by district, plus the null bucket for a DMC duty officer who
 * watches every district at once. A Set per key keeps unsubscribe O(1) and lets
 * one officer hold two tabs without the second one stealing the first's events.
 */
const listeners = new Map<string, Set<Listener>>();

/** Districts never clash with a user id, so one key space is enough. */
function keyFor(district: string | null): string {
  return district ?? "*";
}

/**
 * Subscribe to one district. A null district means "everything", which is what
 * an unassigned DMC duty officer sees; that officer must not be shown another
 * district's traffic by accident, so the wildcard is explicit rather than a
 * missing filter.
 */
export function subscribeDispatchEvents(
  district: string | null,
  listener: Listener
): () => void {
  const key = keyFor(district);
  const bucket = listeners.get(key) ?? new Set<Listener>();

  bucket.add(listener);
  listeners.set(key, bucket);

  return () => {
    const current = listeners.get(key);

    if (!current) return;

    current.delete(listener);

    if (current.size === 0) {
      listeners.delete(key);
    }
  };
}

/**
 * Fire-and-forget by contract: a subscriber that throws must never roll back or
 * obscure a stage that was already committed. Whatever the board misses, its
 * next poll still reads the truth.
 */
export function publishDispatchEvent(
  event: Omit<DispatchLiveEvent, "at">
): void {
  const filled: DispatchLiveEvent = { ...event, at: new Date().toISOString() };
  const key = keyFor(filled.district);

  for (const bucket of [listeners.get(key), listeners.get("*")]) {
    if (!bucket) continue;

    for (const listener of bucket) {
      try {
        listener(filled);
      } catch {
        // A dead socket is closed by its own handler; nothing else to do here.
      }
    }
  }
}

/** How many boards are watching, for the health of a long-running stream. */
export function dispatchEventSubscriberCount(): number {
  let total = 0;

  for (const bucket of listeners.values()) {
    total += bucket.size;
  }

  return total;
}
