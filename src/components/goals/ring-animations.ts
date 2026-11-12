/**
 * Ring animations after a completion (Day 22). One store for the whole app,
 * so every ring for a goal (strip, rail, grid, detail header) plays the same
 * animation, and a goal never plays two at once.
 *
 * Flow, driven by useCompleteTask:
 *   hold(goalId, before)   onMutate, when the optimistic delta is > 0: rings
 *                          keep showing the old progress instead of jumping.
 *   release(goalId, move)  onSettled: with the server's { from, to } and
 *                          to > from, the ring sweeps from -> to and shows
 *                          "+N%" for RING_ANIMATION_MS; otherwise the hold
 *                          just ends.
 *
 * A move that arrives while one is playing waits; several waiting moves merge
 * into one, so a burst of completions plays at most two sweeps.
 */

export const RING_ANIMATION_MS = 1200;

export type RingMove = { from: number; to: number };
export type RingAnimation = RingMove & { key: number };

/** What a ring shows: an animation, a held value, or (both null) its live progress. */
export type RingView = { held: number | null; playing: RingAnimation | null };

type Entry = {
  holds: number;
  held: number | null;
  playing: RingAnimation | null;
  pending: RingMove | null;
};

type Timers = {
  setTimeout: (run: () => void, ms: number) => unknown;
};

export const IDLE_VIEW: RingView = Object.freeze({ held: null, playing: null });

export function createRingAnimations(timers: Timers = globalThis, duration = RING_ANIMATION_MS) {
  const entries = new Map<string, Entry>();
  const views = new Map<string, RingView>();
  const listeners = new Set<() => void>();
  let seq = 0;

  const entryFor = (goalId: string): Entry => {
    const existing = entries.get(goalId);
    if (existing !== undefined) return existing;
    const entry: Entry = { holds: 0, held: null, playing: null, pending: null };
    entries.set(goalId, entry);
    return entry;
  };

  /** Publish a new view object (stable between changes, for useSyncExternalStore). */
  const changed = (goalId: string, entry: Entry) => {
    if (entry.holds === 0 && entry.held === null && entry.playing === null && entry.pending === null) {
      entries.delete(goalId);
      views.delete(goalId);
    } else {
      views.set(goalId, { held: entry.held, playing: entry.playing });
    }
    for (const listener of listeners) listener();
  };

  const start = (goalId: string, entry: Entry, move: RingMove) => {
    seq += 1;
    const key = seq;
    entry.playing = { ...move, key };
    entry.held = null;
    timers.setTimeout(() => finish(goalId, key), duration);
  };

  const finish = (goalId: string, key: number) => {
    const entry = entries.get(goalId);
    if (entry?.playing?.key !== key) return;
    const last = entry.playing;
    entry.playing = null;
    if (entry.pending !== null) {
      // Continue from where the last sweep ended.
      const next = { from: last.to, to: entry.pending.to };
      entry.pending = null;
      start(goalId, entry, next);
    } else {
      // Another completion still in flight: stay where the sweep ended.
      entry.held = entry.holds > 0 ? last.to : null;
    }
    changed(goalId, entry);
  };

  return {
    hold(goalId: string, before: number) {
      const entry = entryFor(goalId);
      entry.holds += 1;
      if (entry.held === null && entry.playing === null) entry.held = before;
      changed(goalId, entry);
    },

    /** End one hold (wasHeld) and play the move if it went up. */
    release(goalId: string, move: RingMove | null, wasHeld: boolean) {
      const entry = entryFor(goalId);
      if (wasHeld) entry.holds = Math.max(0, entry.holds - 1);
      if (move !== null && move.to > move.from) {
        if (entry.playing === null) start(goalId, entry, move);
        else entry.pending = entry.pending === null ? move : { from: entry.pending.from, to: move.to };
      } else if (entry.holds === 0 && entry.playing === null && entry.pending === null) {
        entry.held = null;
      }
      changed(goalId, entry);
    },

    get(goalId: string): RingView {
      return views.get(goalId) ?? IDLE_VIEW;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type RingAnimations = ReturnType<typeof createRingAnimations>;

/** The app-wide store. */
export const ringAnimations = createRingAnimations();

/** "+4%", or "+0.4%" for moves under a point so the label never reads +0%. */
export function formatProgressDelta(delta: number): string {
  const points = delta * 100;
  const shown = Math.abs(points) >= 1 ? String(Math.round(Math.abs(points))) : Math.abs(points).toFixed(1);
  return `${points < 0 ? "-" : "+"}${shown}%`;
}
