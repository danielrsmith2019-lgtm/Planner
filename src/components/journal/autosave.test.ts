import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaver, type AutosaveStatus, type SaveOutcome, type SaveRequest } from "./autosave";

function harness(results: (SaveOutcome | Promise<SaveOutcome>)[]) {
  const requests: SaveRequest[] = [];
  const statuses: AutosaveStatus["state"][] = [];
  const saver = createAutosaver({
    initialContent: { type: "doc" },
    initialVersion: 3,
    save: async (request) => {
      requests.push(request);
      const next = results.shift();
      if (next === undefined) throw new Error("unexpected save");
      return next;
    },
    onStatus: (s) => statuses.push(s.state),
  });
  return { saver, requests, statuses };
}

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

describe("journal autosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces 800ms and sends the latest content with the current version", async () => {
    const { saver, requests, statuses } = harness([{ ok: true, version: 4 }]);
    saver.change({ content: doc("a") });
    await vi.advanceTimersByTimeAsync(500);
    saver.change({ content: doc("ab") });
    await vi.advanceTimersByTimeAsync(799);
    expect(requests).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(requests).toEqual([{ content: doc("ab"), version: 3 }]);
    expect(saver.version).toBe(4);
    expect(statuses.at(-1)).toBe("saved");
  });

  it("includes intention and mood only when they changed", async () => {
    const { saver, requests } = harness([{ ok: true, version: 4 }, { ok: true, version: 5 }]);
    saver.change({ mood: 4 });
    await vi.advanceTimersByTimeAsync(800);
    saver.change({ content: doc("x") });
    await vi.advanceTimersByTimeAsync(800);
    expect(requests[0]).toEqual({ content: { type: "doc" }, version: 3, mood: 4 });
    expect(requests[1]).toEqual({ content: doc("x"), version: 4 });
  });

  it("queues changes made during a save and sends them with the new version", async () => {
    let release: (o: SaveOutcome) => void = () => {};
    const slow = new Promise<SaveOutcome>((resolve) => {
      release = resolve;
    });
    const { saver, requests } = harness([slow, { ok: true, version: 5 }]);
    saver.change({ content: doc("first") });
    await vi.advanceTimersByTimeAsync(800);
    saver.change({ content: doc("second") });
    await vi.advanceTimersByTimeAsync(800);
    expect(requests).toHaveLength(1);
    release({ ok: true, version: 4 });
    await vi.advanceTimersByTimeAsync(0);
    expect(requests[1]).toEqual({ content: doc("second"), version: 4 });
  });

  it("stops on STALE and ignores further changes", async () => {
    const { saver, requests, statuses } = harness([{ ok: false, stale: true, currentVersion: 7 }]);
    saver.change({ content: doc("mine") });
    await vi.advanceTimersByTimeAsync(800);
    expect(statuses.at(-1)).toBe("stale");
    saver.change({ content: doc("more") });
    await vi.advanceTimersByTimeAsync(2000);
    expect(requests).toHaveLength(1);
    expect(saver.stopped).toBe(true);
  });

  it("keeps unsaved fields after an error and retries them on the next save", async () => {
    const { saver, requests, statuses } = harness([
      { ok: false, stale: false, message: "offline" },
      { ok: true, version: 4 },
    ]);
    saver.change({ intention: "Ship it" });
    await vi.advanceTimersByTimeAsync(800);
    expect(statuses.at(-1)).toBe("error");
    await saver.flushNow();
    expect(requests[1]).toEqual({ content: { type: "doc" }, version: 3, intention: "Ship it" });
    expect(statuses.at(-1)).toBe("saved");
  });
});
