import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GOAL_COLORS } from "@/lib/domain/goal-colors";
import { seedUser } from "../../test/seed";
import { NotFoundError, ValidationError } from "./errors";
import { ACTIVE_GOAL_LIMIT_MESSAGE, MAX_ACTIVE_GOALS, createGoal, createMilestone, setGoalStatus } from "./goals";
import { listGoals } from "./day";
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
    await expect(createGoal(user.id, { ...base, title: "One too many" })).rejects.toThrow(ACTIVE_GOAL_LIMIT_MESSAGE);
  });

  it("rejects a color another active goal already uses", async () => {
    const user = await seedUser();
    await createGoal(user.id, { ...base, title: "First", color: GOAL_COLORS[2] });
    await expect(createGoal(user.id, { ...base, title: "Second", color: GOAL_COLORS[2] })).rejects.toBeInstanceOf(
      ValidationError,
    );
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

describe("setGoalStatus", () => {
  const NOW = new Date("2026-11-12T17:00:00Z");

  async function fiveActive() {
    const user = await seedUser();
    const goals = [];
    for (let i = 0; i < MAX_ACTIVE_GOALS; i++) goals.push(await createGoal(user.id, { ...base, title: `Goal ${i}` }));
    return { user, goals };
  }

  it("pauses and resumes a goal", async () => {
    const user = await seedUser();
    const goal = await createGoal(user.id, { ...base, title: "Run" });
    expect(await setGoalStatus(user.id, goal.id, "PAUSED")).toMatchObject({ status: "PAUSED" });
    expect(await setGoalStatus(user.id, goal.id, "ACTIVE")).toMatchObject({ status: "ACTIVE", color: goal.color });
  });

  it("refuses to resume when 5 goals are already active, with the friendly message", async () => {
    const { user, goals } = await fiveActive();
    await setGoalStatus(user.id, goals[0].id, "PAUSED");
    await createGoal(user.id, { ...base, title: "Replacement" });
    await expect(setGoalStatus(user.id, goals[0].id, "ACTIVE")).rejects.toThrow(ACTIVE_GOAL_LIMIT_MESSAGE);
    expect((await prisma.goal.findUniqueOrThrow({ where: { id: goals[0].id } })).status).toBe("PAUSED");
  });

  it("gives a resumed goal a free color when its old one was taken", async () => {
    const user = await seedUser();
    const paused = await createGoal(user.id, { ...base, title: "Paused", color: GOAL_COLORS[0] });
    await setGoalStatus(user.id, paused.id, "PAUSED");
    await createGoal(user.id, { ...base, title: "Took green", color: GOAL_COLORS[0] });
    const resumed = await setGoalStatus(user.id, paused.id, "ACTIVE");
    expect(resumed.color).toBe(GOAL_COLORS[1]);
  });

  it("completes a goal with completedAt and a GOAL_COMPLETED event, and reopening clears it", async () => {
    const user = await seedUser();
    const goal = await createGoal(user.id, { ...base, title: "Read" });
    const done = await setGoalStatus(user.id, goal.id, "COMPLETED", { now: NOW });
    expect(done).toMatchObject({ status: "COMPLETED", completedAt: NOW });
    const events = await prisma.activityEvent.findMany({ where: { goalId: goal.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "GOAL_COMPLETED", localDate: new Date("2026-11-12T00:00:00Z") });
    expect(await setGoalStatus(user.id, goal.id, "ACTIVE")).toMatchObject({ status: "ACTIVE", completedAt: null });
  });

  it("archived goals leave the list; the same status twice is a no-op", async () => {
    const user = await seedUser();
    const goal = await createGoal(user.id, { ...base, title: "Old" });
    await setGoalStatus(user.id, goal.id, "ARCHIVED");
    const again = await setGoalStatus(user.id, goal.id, "ARCHIVED");
    expect(again.status).toBe("ARCHIVED");
    expect(await listGoals(user.id)).toEqual([]);
  });

  it("can't touch another user's goal", async () => {
    const owner = await seedUser();
    const goal = await createGoal(owner.id, { ...base, title: "Mine" });
    const other = await seedUser();
    await expect(setGoalStatus(other.id, goal.id, "ARCHIVED")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("listGoals", () => {
  it("includes each goal's first open milestone", async () => {
    const user = await seedUser();
    const goal = await createGoal(user.id, { ...base, title: "Site" });
    const first = await createMilestone(user.id, goal.id, { title: "Design" });
    await createMilestone(user.id, goal.id, { title: "Build" });
    await prisma.milestone.update({ where: { id: first.id }, data: { status: "DONE" } });
    const [summary] = await listGoals(user.id);
    expect(summary).toMatchObject({ nextMilestone: { title: "Build" }, milestoneCount: 2 });
  });
});
