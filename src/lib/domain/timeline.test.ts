import { describe, expect, it } from "vitest";
import { formatSpan, hourLabel, snapDuration, snapStartMin, timelineRange } from "./timeline";

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

describe("drag snapping", () => {
  const px = 1.2;
  it("snaps the pointer offset to quarter hours from the first visible hour", () => {
    // 6 AM grid: 90 minutes down = 7:30; 97 minutes rounds to 7:30, 98 to 7:45
    expect(snapStartMin(90 * px, px, 6, 23, 30)).toBe(7 * 60 + 30);
    expect(snapStartMin(97 * px, px, 6, 23, 30)).toBe(7 * 60 + 30);
    expect(snapStartMin(98 * px, px, 6, 23, 30)).toBe(7 * 60 + 45);
  });

  it("clamps to the visible hours, keeping the whole block inside", () => {
    expect(snapStartMin(-50, px, 6, 23, 30)).toBe(6 * 60);
    expect(snapStartMin(10_000, px, 6, 23, 60)).toBe(22 * 60);
  });

  it("resizes to a snapped end, at least 15 minutes, not past the last hour", () => {
    const start = 9 * 60;
    expect(snapDuration(start, (10 * 60 + 20 - 6 * 60) * px, px, 6, 23)).toBe(75); // 10:20 -> 10:15
    expect(snapDuration(start, (9 * 60 - 6 * 60) * px, px, 6, 23)).toBe(15);
    expect(snapDuration(start, 99_999, px, 6, 23)).toBe(23 * 60 - start);
  });

  it("labels the preview span", () => {
    expect(formatSpan(7 * 60 + 30, 8 * 60 + 15)).toBe("7:30-8:15");
    expect(formatSpan(11 * 60 + 45, 12 * 60 + 30)).toBe("11:45-12:30");
  });
});
