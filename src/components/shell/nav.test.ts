import { describe, expect, it } from "vitest";
import { NAV_ITEMS, TAB_ITEMS_LEFT, TAB_ITEMS_RIGHT, getHeaderConfig, isActivePath } from "./nav";

describe("isActivePath", () => {
  it("matches the route and its children only", () => {
    expect(isActivePath("/goals", "/goals")).toBe(true);
    expect(isActivePath("/goals/abc", "/goals")).toBe(true);
    expect(isActivePath("/goalsx", "/goals")).toBe(false);
    expect(isActivePath("/today", "/goals")).toBe(false);
  });
});

describe("tabs", () => {
  it("puts Today and Week left of Quick add, Journal and Goals right of it", () => {
    expect(TAB_ITEMS_LEFT.map((i) => i.label)).toEqual(["Today", "Week"]);
    expect(TAB_ITEMS_RIGHT.map((i) => i.label)).toEqual(["Journal", "Goals"]);
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(["/today", "/week", "/journal", "/goals", "/settings"]);
  });
});

describe("getHeaderConfig", () => {
  it("shows the date navigator and mode chip on Today", () => {
    expect(getHeaderConfig("/today")).toEqual({ title: "Today", dateNav: true, dateStep: 1, modeChip: true });
  });

  it("steps a week at a time on the week view", () => {
    expect(getHeaderConfig("/week")).toMatchObject({ dateNav: true, dateStep: 7, modeChip: false });
  });

  it("uses a plain title on goals and settings, including nested routes", () => {
    expect(getHeaderConfig("/goals/abc")).toMatchObject({ title: "Goals", dateNav: false });
    expect(getHeaderConfig("/settings")).toMatchObject({ title: "Settings", dateNav: false });
  });

  it("falls back for unknown routes", () => {
    expect(getHeaderConfig("/somewhere")).toMatchObject({ title: "Planner", dateNav: false });
  });
});
