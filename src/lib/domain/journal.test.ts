import { describe, expect, it } from "vitest";
import { formatMonth, monthBounds, monthGrid, moodFor, shiftMonth } from "./journal";

describe("journal month helpers", () => {
  it("shifts months across years", () => {
    expect(shiftMonth("2026-11", 1)).toBe("2026-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(formatMonth("2026-11")).toBe("November 2026");
    expect(monthBounds("2028-02")).toEqual({ first: "2028-02-01", last: "2028-02-29" });
  });

  it("builds Monday-first weeks covering the month", () => {
    const weeks = monthGrid("2026-11");
    // Nov 1 2026 is a Sunday, so the grid starts on Mon Oct 26 and ends Sun Dec 6.
    expect(weeks[0]?.[0]).toEqual({ date: "2026-10-26", inMonth: false });
    expect(weeks[0]?.[6]).toEqual({ date: "2026-11-01", inMonth: true });
    expect(weeks.at(-1)?.[6]).toEqual({ date: "2026-12-06", inMonth: false });
    expect(weeks).toHaveLength(6);
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(30);
  });

  it("maps moods 1-5", () => {
    expect(moodFor(5)?.label).toBe("Great");
    expect(moodFor(null)).toBeNull();
    expect(moodFor(9)).toBeNull();
  });
});
