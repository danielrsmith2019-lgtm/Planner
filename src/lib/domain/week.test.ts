import { describe, expect, it } from "vitest";
import { dayHeader, formatWeekLabel, startOfWeek, weekDates, weekdayIndex } from "./week";

describe("week helpers", () => {
  it("finds the Monday of a week", () => {
    expect(weekdayIndex("2026-11-09")).toBe(0); // Monday
    expect(weekdayIndex("2026-11-15")).toBe(6); // Sunday
    expect(startOfWeek("2026-11-12")).toBe("2026-11-09");
    expect(startOfWeek("2026-11-15")).toBe("2026-11-09");
    expect(startOfWeek("2026-11-16")).toBe("2026-11-16");
    expect(startOfWeek("1970-01-01")).toBe("1969-12-29");
  });

  it("lists 7 dates and short headers", () => {
    expect(weekDates("2026-11-30")).toEqual([
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-05",
      "2026-12-06",
    ]);
    expect(dayHeader("2026-12-03")).toEqual({ weekday: "THU", day: 3 });
  });

  it("labels weeks within a month, across months and across years", () => {
    expect(formatWeekLabel("2026-11-09")).toBe("Nov 9 - 15");
    expect(formatWeekLabel("2026-11-30")).toBe("Nov 30 - Dec 6");
    expect(formatWeekLabel("2026-12-28")).toBe("Dec 28, 2026 - Jan 3, 2027");
  });
});
