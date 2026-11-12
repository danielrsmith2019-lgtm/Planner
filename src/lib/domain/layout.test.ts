import { describe, expect, it } from "vitest";
import { packOverlaps, type TimedBlock } from "./layout";

const at = (h: number, m = 0) => h * 60 + m;
const block = (id: string, start: number, end: number): TimedBlock => ({ id, startMin: start, durationMin: end - start });
const layout = (blocks: TimedBlock[]) =>
  Object.fromEntries(packOverlaps(blocks).map((b) => [b.task.id, { column: b.column, columns: b.columns }]));

describe("packOverlaps", () => {
  it("gives non-overlapping blocks the full width, including blocks that only touch", () => {
    expect(
      layout([block("b", at(10), at(11)), block("a", at(9), at(10)), block("c", at(13), at(14))]),
    ).toEqual({
      a: { column: 0, columns: 1 },
      b: { column: 0, columns: 1 },
      c: { column: 0, columns: 1 },
    });
  });

  it("packs a chain of 3 overlaps into 2 columns (A and C don't overlap each other)", () => {
    // A 9:00-10:00, B 9:30-10:30, C 10:15-11:00
    expect(layout([block("A", at(9), at(10)), block("B", at(9, 30), at(10, 30)), block("C", at(10, 15), at(11))])).toEqual({
      A: { column: 0, columns: 2 },
      B: { column: 1, columns: 2 },
      C: { column: 0, columns: 2 },
    });
  });

  it("puts three mutually overlapping blocks in 3 columns", () => {
    expect(layout([block("A", at(9), at(11)), block("B", at(9, 30), at(11)), block("C", at(10), at(11))])).toEqual({
      A: { column: 0, columns: 3 },
      B: { column: 1, columns: 3 },
      C: { column: 2, columns: 3 },
    });
  });

  it("handles nested blocks: short blocks inside a long one share the second column", () => {
    // A 9:00-12:00 contains B 9:30-10:00 and C 10:30-11:00
    expect(layout([block("B", at(9, 30), at(10)), block("A", at(9), at(12)), block("C", at(10, 30), at(11))])).toEqual({
      A: { column: 0, columns: 2 },
      B: { column: 1, columns: 2 },
      C: { column: 1, columns: 2 },
    });
  });

  it("starts a new cluster after a gap, and gives the longer block column 0 on a tie", () => {
    const result = layout([
      block("short", at(9), at(9, 30)),
      block("long", at(9), at(10)),
      block("later", at(14), at(15)),
    ]);
    expect(result).toEqual({
      long: { column: 0, columns: 2 },
      short: { column: 1, columns: 2 },
      later: { column: 0, columns: 1 },
    });
  });

  it("uses the default 30 minutes for a missing duration", () => {
    const packed = packOverlaps([{ id: "x", startMin: at(8), durationMin: null }]);
    expect(packed[0]).toMatchObject({ startMin: at(8), endMin: at(8, 30), columns: 1 });
  });
});
