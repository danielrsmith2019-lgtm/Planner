import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { recomputeGoal } from "@/services/goals";
import { seedUser } from "../test/seed";
import { DEMO_EMAIL, seedDemo } from "./seed-data";

// 2026-11-09, 3:00pm New York
const NOW = new Date("2026-11-09T20:00:00Z");

describe("seedDemo", () => {
  it("creates the requested shape of data", async () => {
    const summary = await seedDemo({ now: NOW });
    expect(summary).toMatchObject({
      email: DEMO_EMAIL,
      today: "2026-11-09",
      goals: 3,
      milestones: 8,
      tasks: 40,
      journalEntries: 10,
    });
    expect(summary.doneTasks).toBeGreaterThan(10);
    expect(summary.carriedTasks).toBe(3);
    expect(summary.journalLinks).toBeGreaterThan(15);
  });

  it("puts every task within the last 7 and next 7 days", async () => {
    await seedDemo({ now: NOW });
    const tasks = await prisma.task.findMany({ select: { scheduledDate: true } });
    const days = tasks.map((t) => t.scheduledDate?.toISOString().slice(0, 10));
    expect(days.every((d) => d !== undefined && d >= "2026-11-02" && d <= "2026-11-16")).toBe(true);
  });

  it("produces cached progress identical to a full rebuild", async () => {
    await seedDemo({ now: NOW });
    const goals = await prisma.goal.findMany({ orderBy: { rank: "asc" } });
    for (const goal of goals) {
      const rebuilt = await recomputeGoal(goal.id);
      expect(rebuilt.progress).toBe(goal.progress);
      expect(rebuilt.metricCurrent).toBe(goal.metricCurrent.toNumber());
    }
    const [marathon, portfolio, reading] = goals;
    expect(marathon.metricCurrent.toNumber()).toBe(54); // 8 + 10 + 6 + 16 + 9 + 5 km
    expect(reading.metricCurrent.toNumber()).toBe(1);
    expect(portfolio.progress).toBeGreaterThan(0);
  });

  it("logs completion and carry events with local dates and payloads", async () => {
    const summary = await seedDemo({ now: NOW });
    const completed = await prisma.activityEvent.findMany({ where: { type: "TASK_COMPLETED" } });
    expect(completed).toHaveLength(summary.doneTasks);
    expect(completed.filter((e) => e.goalId !== null).every((e) => e.payload !== null)).toBe(true);
    expect(await prisma.activityEvent.count({ where: { type: "TASK_CARRIED" } })).toBe(5); // 1 + 3 + 1 carries

    const stuck = await prisma.task.findFirstOrThrow({ where: { title: "Draft case study: BaseCamp" } });
    expect(stuck).toMatchObject({ carryCount: 3, status: "TODO" });
    expect(stuck.scheduledDate?.toISOString().slice(0, 10)).toBe("2026-11-09");
  });

  it("is safe to run twice and leaves other users alone", async () => {
    const bystander = await seedUser();
    await seedDemo({ now: NOW });
    const again = await seedDemo({ now: NOW });
    expect(again.tasks).toBe(40);
    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.user.findUnique({ where: { id: bystander.id } })).not.toBeNull();
  });
});
