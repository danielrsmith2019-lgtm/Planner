import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GOAL_COLORS } from "@/lib/domain/goal-colors";
import { seedUser } from "../../test/seed";
import { NotFoundError, ValidationError } from "./errors";
import { MAX_ACTIVE_GOALS, createGoal, createMilestone } from "./goals";
import { completeTask, createTask } from "./tasks";

const base = { progressMode: "MILESTONES" as const, startDate: "2026-11-01" };

describe("createGoal", () => {
  it("creates a goal with the first unused color and an increasing rank", async () => {
    const user = await seedUser();
    const first = await createGoal(user.id, { ...base, title: "Portfolio" });
    const second = await createGoal(user.id, { ...base, title: "Marathon" });
    expect(first.color).toBe(GOAL_COLORS[0]);
    expect(second.color).toBe(GOAL_COLORS[1]);
    expect(second.rank > first.rank).toBe(true);
    expect(first).toMatchObject({ status: "ACTIVE", progress: 0, metricCurrent: 0, startDate: "2026-11-01" });
  });

  it(`allows at most ${MAX_ACTIVE_GOALS} active goals`, async () => {
    const user = await seedUser();
    for (let i = 0; i < MAX_ACTIVE_GOALS; i++) await createGoal(user.id, { ...base, title: `Goal ${i}` });
    await expect(createGoal(user.id, { ...base, title: "One too many" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("requires a target and unit for metric goals", async () => {
    const user = await seedUser();
    await expect(createGoal(user.id, { ...base, progressMode: "METRIC", title: "Run" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    const goal = await createGoal(user.id, {
      ...base,
      progressMode: "METRIC",
      title: "Run",
      metricTarget: 500,
      metricUnit: "km",
    });
    expect(goal).toMatchObject({ metricTarget: 500, metricUnit: "km" });
  });

  it("rejects colors outside the palette and target dates before the start", async () => {
    const user = await seedUser();
    await expect(createGoal(user.id, { ...base, title: "x", color: "#123456" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createGoal(user.id, { ...base, title: "x", targetDate: "2026-10-01" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("createMilestone", () => {
  it("adds a milestone and recomputes the goal's weighted progress", async () => {
    const user = await seedUser();
    const goal = await createGoal(user.id, { ...base, title: "Portfolio" });
    const m1 = await createMilestone(user.id, goal.id, { title: "Design", weight: 1 });
    const task = await createTask(user.id, { title: "Wireframe", link: { milestoneId: m1.id } });
    await completeTask(user.id, task.id);
    expect((await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).progress).toBe(0.95);

    const m2 = await createMilestone(user.id, goal.id, { title: "Launch", weight: 3 });
    expect(m2.rank > m1.rank).toBe(true);
    expect((await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).progress).toBeCloseTo(0.95 / 4, 12);
  });

  it("validates weight and ownership", async () => {
    const user = await seedUser();
    const goal = await createGoal(user.id, { ...base, title: "Portfolio" });
    await expect(createMilestone(user.id, goal.id, { title: "x", weight: 4 })).rejects.toBeInstanceOf(ValidationError);
    const stranger = await seedUser();
    await expect(createMilestone(stranger.id, goal.id, { title: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });
});
