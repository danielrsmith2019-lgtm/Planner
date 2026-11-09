import { describe, expect, it } from "vitest";
import { AHEAD_MARGIN, BEHIND_MARGIN, computeExpectedProgress, computePace } from "./pace";

// 10-day window; on Jan 6 the goal should be exactly half done.
const HALFWAY = { startDate: "2026-01-01", targetDate: "2026-01-11", today: "2026-01-06" } as const;

describe("computeExpectedProgress", () => {
  it("is the share of the window that has elapsed", () => {
    expect(computeExpectedProgress(HALFWAY)).toBe(0.5);
  });

  it("is null without a target date", () => {
    expect(computeExpectedProgress({ startDate: "2026-01-01", targetDate: null, today: "2026-01-06" })).toBeNull();
  });

  it("is 0 before the start date", () => {
    expect(computeExpectedProgress({ ...HALFWAY, today: "2025-12-25" })).toBe(0);
  });

  it("is 1 on the target date", () => {
    expect(computeExpectedProgress({ ...HALFWAY, today: "2026-01-11" })).toBe(1);
  });

  it("is capped at 1 once the target date has passed", () => {
    expect(computeExpectedProgress({ ...HALFWAY, today: "2026-03-01" })).toBe(1);
  });

  it("counts whole calendar days across a DST change", () => {
    // US clocks spring forward on 2026-03-08; day 15 of a 30-day window is still 0.5.
    expect(computeExpectedProgress({ startDate: "2026-03-01", targetDate: "2026-03-31", today: "2026-03-16" })).toBe(
      0.5,
    );
  });

  it("handles a target date equal to the start date", () => {
    expect(computeExpectedProgress({ startDate: "2026-01-01", targetDate: "2026-01-01", today: "2025-12-31" })).toBe(0);
    expect(computeExpectedProgress({ startDate: "2026-01-01", targetDate: "2026-01-01", today: "2026-01-01" })).toBe(1);
  });

  it("rejects dates that aren't YYYY-MM-DD calendar days", () => {
    expect(() => computeExpectedProgress({ ...HALFWAY, today: "2026-1-6" })).toThrow(RangeError);
    expect(() => computeExpectedProgress({ ...HALFWAY, today: "2026-02-30" })).toThrow(RangeError);
    expect(() => computeExpectedProgress({ ...HALFWAY, today: "2026-01-06T09:00:00Z" })).toThrow(RangeError);
  });
});

describe("computePace", () => {
  it("is null when the goal has no target date", () => {
    expect(computePace({ progress: 0.4, startDate: "2026-01-01", targetDate: null, today: "2026-01-06" })).toBeNull();
  });

  it("uses margins of +0.05 and -0.10", () => {
    expect(AHEAD_MARGIN).toBe(0.05);
    expect(BEHIND_MARGIN).toBe(0.1);
  });

  describe("at the ahead boundary (expected 0.5 + 0.05 = 0.55)", () => {
    it("is ahead at exactly 0.55", () => {
      expect(computePace({ ...HALFWAY, progress: 0.55 })).toBe("ahead");
    });

    it("is on track just below 0.55", () => {
      expect(computePace({ ...HALFWAY, progress: 0.5499 })).toBe("on_track");
    });
  });

  describe("at the behind boundary (expected 0.5 - 0.10 = 0.40)", () => {
    it("is on track at exactly 0.40", () => {
      expect(computePace({ ...HALFWAY, progress: 0.4 })).toBe("on_track");
    });

    it("is behind just below 0.40", () => {
      expect(computePace({ ...HALFWAY, progress: 0.3999 })).toBe("behind");
    });
  });

  it("is on track exactly on schedule", () => {
    expect(computePace({ ...HALFWAY, progress: 0.5 })).toBe("on_track");
  });

  it("holds the boundaries when the arithmetic isn't exact in floating point", () => {
    // 100-day window, day 30: expected 0.3. 0.3 - 0.1 is 0.19999999999999998 in JS.
    const window = { startDate: "2026-01-01", targetDate: "2026-04-11", today: "2026-01-31" };
    expect(computeExpectedProgress(window)).toBeCloseTo(0.3, 12);
    expect(computePace({ ...window, progress: 0.35 })).toBe("ahead");
    expect(computePace({ ...window, progress: 0.2 })).toBe("on_track");
    expect(computePace({ ...window, progress: 0.1999 })).toBe("behind");
  });

  describe("when the target date is in the past", () => {
    const overdue = { startDate: "2026-01-01", targetDate: "2026-01-11", today: "2026-03-01" };

    it("is behind if the goal is well short of done", () => {
      expect(computePace({ ...overdue, progress: 0.6 })).toBe("behind");
    });

    it("is on track within 0.10 of done", () => {
      expect(computePace({ ...overdue, progress: 0.9 })).toBe("on_track");
    });

    it("is on track (not behind) once the goal is complete", () => {
      expect(computePace({ ...overdue, progress: 1 })).toBe("on_track");
    });
  });

  it("is on track at 0 before the start date", () => {
    expect(computePace({ ...HALFWAY, today: "2025-12-25", progress: 0 })).toBe("on_track");
  });
});
