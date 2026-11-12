import { describe, expect, it } from "vitest";
import { createRingAnimations, formatProgressDelta, IDLE_VIEW } from "./ring-animations";

/** Manual timers: run() fires everything scheduled so far, in order. */
function fakeTimers() {
  let queue: (() => void)[] = [];
  return {
    setTimeout: (fn: () => void) => {
      queue.push(fn);
      return queue.length;
    },
    run() {
      const due = queue;
      queue = [];
      for (const fn of due) fn();
    },
    get size() {
      return queue.length;
    },
  };
}

describe("ring animations", () => {
  it("holds the old value, then plays from -> to after the server settles", () => {
    const timers = fakeTimers();
    const store = createRingAnimations(timers);
    store.hold("g1", 0.1);
    expect(store.get("g1")).toEqual({ held: 0.1, playing: null });

    store.release("g1", { from: 0.1, to: 0.14 }, true);
    expect(store.get("g1")).toMatchObject({ held: null, playing: { from: 0.1, to: 0.14 } });

    timers.run();
    expect(store.get("g1")).toBe(IDLE_VIEW);
  });

  it("just ends the hold when the move didn't go up (error, no change, uncomplete)", () => {
    const store = createRingAnimations(fakeTimers());
    store.hold("g1", 0.3);
    store.release("g1", null, true);
    expect(store.get("g1")).toBe(IDLE_VIEW);
    store.release("g1", { from: 0.3, to: 0.2 }, false);
    expect(store.get("g1")).toBe(IDLE_VIEW);
  });

  it("plays one animation at a time and merges the ones that wait", () => {
    const timers = fakeTimers();
    const store = createRingAnimations(timers);
    for (const before of [0.1, 0.14, 0.18]) store.hold("g1", before);
    expect(store.get("g1").held).toBe(0.1);

    store.release("g1", { from: 0.1, to: 0.14 }, true);
    store.release("g1", { from: 0.14, to: 0.18 }, true);
    store.release("g1", { from: 0.18, to: 0.22 }, true);
    const first = store.get("g1").playing;
    expect(first).toMatchObject({ from: 0.1, to: 0.14 });

    timers.run();
    const second = store.get("g1").playing;
    expect(second).toMatchObject({ from: 0.14, to: 0.22 });
    expect(second?.key).not.toBe(first?.key);

    timers.run();
    expect(store.get("g1")).toBe(IDLE_VIEW);
  });

  it("stays at the end of a sweep while another completion is still in flight", () => {
    const timers = fakeTimers();
    const store = createRingAnimations(timers);
    store.hold("g1", 0.1);
    store.hold("g1", 0.14);
    store.release("g1", { from: 0.1, to: 0.14 }, true);
    timers.run();
    expect(store.get("g1")).toEqual({ held: 0.14, playing: null });
    store.release("g1", { from: 0.14, to: 0.18 }, true);
    expect(store.get("g1").playing).toMatchObject({ from: 0.14, to: 0.18 });
  });

  it("keeps goals independent and notifies subscribers", () => {
    const store = createRingAnimations(fakeTimers());
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.release("g1", { from: 0, to: 0.1 }, false);
    store.release("g2", { from: 0.5, to: 0.6 }, false);
    expect(store.get("g1").playing?.to).toBe(0.1);
    expect(store.get("g2").playing?.to).toBe(0.6);
    expect(calls).toBe(2);
    unsubscribe();
    store.hold("g3", 0);
    expect(calls).toBe(2);
  });

  it("returns the same view object until something changes", () => {
    const store = createRingAnimations(fakeTimers());
    store.hold("g1", 0.2);
    expect(store.get("g1")).toBe(store.get("g1"));
  });
});

describe("formatProgressDelta", () => {
  it("rounds to whole points and keeps small moves visible", () => {
    expect(formatProgressDelta(0.04)).toBe("+4%");
    expect(formatProgressDelta(0.126)).toBe("+13%");
    expect(formatProgressDelta(0.004)).toBe("+0.4%");
    expect(formatProgressDelta(-0.02)).toBe("-2%");
  });
});
