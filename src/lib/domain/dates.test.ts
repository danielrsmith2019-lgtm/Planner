import { describe, expect, it } from "vitest";
import { addDays, getLocalToday, labelToMinutes, minutesToLabel, toDayNumber } from "./dates";

const NY = { timezone: "America/New_York", dayStartsAt: 240 };
const at = (iso: string) => new Date(iso);

describe("getLocalToday", () => {
  describe("dayStartsAt boundary (4:00am, regular day)", () => {
    // 2026-06-15 is EDT (UTC-4): 4:00am local = 08:00Z
    it("returns today at exactly 4:00:00am", () => {
      expect(getLocalToday(NY, at("2026-06-15T08:00:00.000Z"))).toBe("2026-06-15");
    });

    it("returns yesterday one millisecond before 4:00am", () => {
      expect(getLocalToday(NY, at("2026-06-15T07:59:59.999Z"))).toBe("2026-06-14");
    });

    it("returns yesterday at 1:30am", () => {
      expect(getLocalToday(NY, at("2026-06-15T05:30:00Z"))).toBe("2026-06-14");
    });

    it("returns today in the evening", () => {
      expect(getLocalToday(NY, at("2026-06-16T02:30:00Z"))).toBe("2026-06-15"); // 10:30pm EDT
    });
  });

  describe("spring forward weekend (2026-03-08: 2:00am EST jumps to 3:00am EDT)", () => {
    it("treats 1:30am EST as the previous day", () => {
      expect(getLocalToday(NY, at("2026-03-08T06:30:00Z"))).toBe("2026-03-07");
    });

    it("treats 3:30am EDT (just after the jump) as the previous day", () => {
      expect(getLocalToday(NY, at("2026-03-08T07:30:00Z"))).toBe("2026-03-07");
    });

    it("treats 3:59am EDT as the previous day", () => {
      expect(getLocalToday(NY, at("2026-03-08T07:59:00Z"))).toBe("2026-03-07");
    });

    it("starts the new day at exactly 4:00am EDT", () => {
      // A naive "subtract 4 hours from the instant" lands on 11:00pm EST Mar 7.
      expect(getLocalToday(NY, at("2026-03-08T08:00:00Z"))).toBe("2026-03-08");
    });

    it("is unaffected the next morning", () => {
      expect(getLocalToday(NY, at("2026-03-09T08:00:00Z"))).toBe("2026-03-09");
    });
  });

  describe("fall back weekend (2026-11-01: 2:00am EDT repeats 1:00am EST)", () => {
    it("treats the first 1:30am (EDT) as the previous day", () => {
      expect(getLocalToday(NY, at("2026-11-01T05:30:00Z"))).toBe("2026-10-31");
    });

    it("treats the second 1:30am (EST) as the previous day", () => {
      expect(getLocalToday(NY, at("2026-11-01T06:30:00Z"))).toBe("2026-10-31");
    });

    it("treats 3:59am EST as the previous day", () => {
      // A naive instant shift lands on 12:59am EDT Nov 1 and returns the wrong day.
      expect(getLocalToday(NY, at("2026-11-01T08:59:00Z"))).toBe("2026-10-31");
    });

    it("starts the new day at exactly 4:00am EST", () => {
      expect(getLocalToday(NY, at("2026-11-01T09:00:00Z"))).toBe("2026-11-01");
    });
  });

  it("uses plain local midnight when dayStartsAt is 0", () => {
    const user = { timezone: "America/New_York", dayStartsAt: 0 };
    expect(getLocalToday(user, at("2026-06-15T04:00:00Z"))).toBe("2026-06-15");
    expect(getLocalToday(user, at("2026-06-15T03:59:59Z"))).toBe("2026-06-14");
  });

  it("rolls back across a year boundary", () => {
    expect(getLocalToday(NY, at("2027-01-01T07:00:00Z"))).toBe("2026-12-31"); // 2:00am EST Jan 1
  });

  it("uses the user's own timezone, not the server's", () => {
    const tokyo = { timezone: "Asia/Tokyo", dayStartsAt: 240 };
    expect(getLocalToday(tokyo, at("2026-06-15T18:30:00Z"))).toBe("2026-06-15"); // 3:30am Jun 16 JST
    expect(getLocalToday(tokyo, at("2026-06-15T19:00:00Z"))).toBe("2026-06-16"); // 4:00am Jun 16 JST
  });

  it("rejects an unknown timezone", () => {
    expect(() => getLocalToday({ timezone: "Mars/Olympus", dayStartsAt: 240 }, at("2026-06-15T12:00:00Z"))).toThrow(
      RangeError,
    );
  });

  it("rejects a dayStartsAt outside 0..1439", () => {
    expect(() => getLocalToday({ timezone: "America/New_York", dayStartsAt: 1440 }, new Date())).toThrow(RangeError);
    expect(() => getLocalToday({ timezone: "America/New_York", dayStartsAt: -1 }, new Date())).toThrow(RangeError);
  });

  it("rejects an invalid Date", () => {
    expect(() => getLocalToday(NY, new Date("not a date"))).toThrow(RangeError);
  });
});

describe("addDays and toDayNumber", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-11-01", 7)).toBe("2026-11-08");
  });

  it("counts whole days", () => {
    expect(toDayNumber("2026-03-31") - toDayNumber("2026-03-01")).toBe(30);
  });

  it("rejects malformed and impossible dates", () => {
    expect(() => toDayNumber("2026-2-1")).toThrow(RangeError);
    expect(() => toDayNumber("2026-02-30")).toThrow(RangeError);
  });
});

describe("minutesToLabel", () => {
  it("formats 12-hour labels by default", () => {
    expect(minutesToLabel(0)).toBe("12:00 AM");
    expect(minutesToLabel(450)).toBe("7:30 AM");
    expect(minutesToLabel(720)).toBe("12:00 PM");
    expect(minutesToLabel(765)).toBe("12:45 PM");
    expect(minutesToLabel(1425)).toBe("11:45 PM");
  });

  it("formats 24-hour labels on request", () => {
    expect(minutesToLabel(0, "24h")).toBe("00:00");
    expect(minutesToLabel(450, "24h")).toBe("07:30");
    expect(minutesToLabel(1439, "24h")).toBe("23:59");
  });

  it("rejects values outside a day", () => {
    expect(() => minutesToLabel(-1)).toThrow(RangeError);
    expect(() => minutesToLabel(1440)).toThrow(RangeError);
    expect(() => minutesToLabel(7.5)).toThrow(RangeError);
  });
});

describe("labelToMinutes", () => {
  it.each([
    ["7:30 AM", 450],
    ["7:30am", 450],
    ["7am", 420],
    ["7 pm", 1140],
    ["12am", 0],
    ["12:15 am", 15],
    ["12pm", 720],
    ["12:30 PM", 750],
    ["07:30", 450],
    ["7:30", 450],
    ["19:05", 1145],
    ["0:00", 0],
    ["  9:15 a.m. ", 555],
  ])("parses %j as %i", (label, minutes) => {
    expect(labelToMinutes(label)).toBe(minutes);
  });

  it.each(["", "abc", "25:00", "7:60", "13pm", "0am", "7:5", "24:00", "7:30 xm"])("returns null for %j", (label) => {
    expect(labelToMinutes(label)).toBeNull();
  });

  it("round-trips every 15-minute slot in both formats", () => {
    for (let m = 0; m < 1440; m += 15) {
      expect(labelToMinutes(minutesToLabel(m))).toBe(m);
      expect(labelToMinutes(minutesToLabel(m, "24h"))).toBe(m);
    }
  });
});
