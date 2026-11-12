import { describe, expect, it } from "vitest";
import { fromServerFieldErrors, initialGoalForm, validateGoalForm } from "./goal-form";

const base = { ...initialGoalForm("2026-11-12", "#34C759"), title: "  Launch site  " };

describe("validateGoalForm", () => {
  it("trims and converts a milestones goal, dropping metric fields", () => {
    const result = validateGoalForm({ ...base, metricUnit: "km", metricTarget: "5", why: " " });
    expect(result).toEqual({
      ok: true,
      values: {
        title: "Launch site",
        why: null,
        progressMode: "MILESTONES",
        metricUnit: null,
        metricTarget: null,
        color: "#34C759",
        startDate: "2026-11-12",
        targetDate: null,
      },
    });
  });

  it("requires a unit and a positive target for metric goals", () => {
    const result = validateGoalForm({ ...base, progressMode: "METRIC", metricTarget: "0" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["metricTarget", "metricUnit"]);
    const ok = validateGoalForm({ ...base, progressMode: "METRIC", metricUnit: "km", metricTarget: "500.5" });
    expect(ok).toMatchObject({ ok: true, values: { metricUnit: "km", metricTarget: 500.5 } });
  });

  it("rejects an empty title and a target date before the start", () => {
    const result = validateGoalForm({ ...base, title: " ", targetDate: "2026-11-01" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["targetDate", "title"]);
  });
});

describe("fromServerFieldErrors", () => {
  it("keeps the first message for known fields only", () => {
    expect(fromServerFieldErrors({ title: ["Too long", "x"], bogus: ["y"] })).toEqual({ title: "Too long" });
  });
});
