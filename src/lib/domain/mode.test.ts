import { describe, expect, it } from "vitest";
import { getDefaultMode } from "./mode";

describe("getDefaultMode", () => {
  it.each([
    [0, "plan"],
    [7 * 60, "plan"],
    [10 * 60 + 59, "plan"],
    [11 * 60, "do"],
    [14 * 60 + 30, "do"],
    [17 * 60 + 59, "do"],
    [18 * 60, "reflect"],
    [23 * 60 + 59, "reflect"],
  ])("minute %i is %s", (minute, mode) => {
    expect(getDefaultMode(minute)).toBe(mode);
  });

  it("treats the hours before the user's day starts as the previous evening", () => {
    expect(getDefaultMode(90, 240)).toBe("reflect"); // 1:30am, day starts 4:00am
    expect(getDefaultMode(239, 240)).toBe("reflect");
    expect(getDefaultMode(240, 240)).toBe("plan"); // exactly 4:00am
  });

  it("rejects minutes outside a day", () => {
    expect(() => getDefaultMode(-1)).toThrow(RangeError);
    expect(() => getDefaultMode(1440)).toThrow(RangeError);
    expect(() => getDefaultMode(10.5)).toThrow(RangeError);
  });
});
