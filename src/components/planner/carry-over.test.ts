import { describe, expect, it } from "vitest";
import { buildCarryOverDecisions, summarizeChoices, type CarryChoice } from "./carry-over";

describe("buildCarryOverDecisions", () => {
  it("splits choices into keep, reschedule and drop", () => {
    const choices = new Map<string, CarryChoice>([
      ["a", { action: "keep" }],
      ["b", { action: "reschedule", date: "2026-11-15" }],
      ["c", { action: "drop" }],
      ["d", { action: "keep" }],
    ]);
    expect(buildCarryOverDecisions(choices)).toEqual({
      keep: ["a", "d"],
      reschedule: [{ taskId: "b", date: "2026-11-15" }],
      drop: ["c"],
    });
    expect(summarizeChoices(choices)).toBe("Keep 2, move 1, drop 1");
  });
});
