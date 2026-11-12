import { describe, expect, it } from "vitest";
import { ceilToQuarter, findNextFreeSlot, type SlotTask } from "./slots";

const at = (h: number, m = 0) => h * 60 + m;
const block = (id: string, start: number, end: number, status: SlotTask["status"] = "TODO"): SlotTask => ({
  id,
  startMin: start,
  durationMin: end - start,
  status,
});

describe("findNextFreeSlot", () => {
  it("returns fromMin (rounded up to a quarter hour) on an empty day", () => {
    expect(findNextFreeSlot([], 30, at(9, 7))).toBe(at(9, 15));
    expect(findNextFreeSlot([], 30, at(9))).toBe(at(9));
  });

  it("skips past a block that overlaps, and uses a gap that fits", () => {
    const day = [block("a", at(9), at(10)), block("b", at(11), at(12))];
    expect(findNextFreeSlot(day, 30, at(9, 15))).toBe(at(10));
    expect(findNextFreeSlot(day, 60, at(9, 15))).toBe(at(10));
    expect(findNextFreeSlot(day, 90, at(9, 15))).toBe(at(12));
  });

  it("walks a chain of back-to-back and overlapping blocks", () => {
    const day = [block("a", at(8), at(9)), block("b", at(9), at(9, 40)), block("c", at(9, 30), at(10, 5))];
    // b ends 9:40, c ends 10:05 -> next quarter after 10:05 is 10:15
    expect(findNextFreeSlot(day, 15, at(8))).toBe(at(10, 15));
  });

  it("ignores skipped tasks, untimed tasks and the task being moved; done tasks still block", () => {
    const day: SlotTask[] = [
      block("skipped", at(13), at(14), "SKIPPED"),
      { id: "anytime", startMin: null, durationMin: 60 },
      block("self", at(13), at(14)),
      block("done", at(14), at(15), "DONE"),
    ];
    expect(findNextFreeSlot(day, 60, at(13), undefined, "self")).toBe(at(13));
    expect(findNextFreeSlot(day, 90, at(13), undefined, "self")).toBe(at(15));
  });

  it("treats a missing duration as the default 30 minutes", () => {
    expect(findNextFreeSlot([{ id: "x", startMin: at(18), durationMin: null }], 30, at(18))).toBe(at(18, 30));
  });

  it("returns null when nothing fits before the end of the day", () => {
    expect(findNextFreeSlot([block("late", at(22), at(23, 50))], 30, at(22))).toBeNull();
    expect(findNextFreeSlot([], 60, at(23, 30))).toBeNull();
    expect(findNextFreeSlot([], 30, at(23, 30))).toBe(at(23, 30));
    expect(findNextFreeSlot([], 0, at(9))).toBeNull();
  });

  it("rounds up to quarter hours", () => {
    expect([0, 1, 14, 15, 16].map(ceilToQuarter)).toEqual([0, 15, 15, 15, 30]);
  });
});
