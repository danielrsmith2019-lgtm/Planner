import { describe, expect, it } from "vitest";
import { hourLabel, timelineRange } from "./timeline";

describe("timelineRange", () => {
  it("defaults to 6 AM - 11 PM and widens to fit early, late and long blocks", () => {
    expect(timelineRange([])).toEqual({ startHour: 6, endHour: 23 });
    expect(timelineRange([{ id: "a", startMin: 5 * 60 + 30, durationMin: 30 }])).toEqual({ startHour: 5, endHour: 23 });
    expect(timelineRange([{ id: "b", startMin: 23 * 60, durationMin: 45 }])).toEqual({ startHour: 6, endHour: 24 });
    expect(timelineRange([], 2 * 60 + 10)).toEqual({ startHour: 2, endHour: 23 });
  });

  it("labels hours", () => {
    expect([0, 6, 12, 13, 23].map(hourLabel)).toEqual(["12 AM", "6 AM", "12 PM", "1 PM", "11 PM"]);
  });
});
