import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedGoal, seedMilestone, seedUser } from "../../test/seed";
import { findNextStep, getDay, getGoalDetail, listGoals } from "./day";
import { NotFoundError } from "./errors";
import { createTask } from "./tasks";

// Goals run 2026-11-01 -> 2027-04-01 (seedGoal), so on Nov 9 about 5% is expected.
const NOW = new Date("2026-11-09T20:00:00Z");
const DATE = "2026-11-09";

/** Five goals created in rank order: ahead, on track, behind, stalled, paused. */
async function setup() {
  const user = await seedUser();
  const ahead = await seedGoal(user.id, { title: "Ahead" });
  const onTrack = await seedGoal(user.id, { title: "On track" });
  const behind = await seedGoal(user.id, { title: "Behind" });
  const stalled = await seedGoal(user.id, { title: "Stalled" });
  const paused = await seedGoal(user.id, { title: "Paused" });
  for (const goal of [ahead, onTrack, behind]) {
    await createTask(user.id, { title: `${goal.title} step`, link: { goalId: goal.id }, scheduledDate: "2026-11-10" });
  }
  // Outside the 7-day window and in the backlog: neither counts as a planned step.
  await createTask(user.id, { title: "Far off", link: { goalId: stalled.id }, scheduledDate: "2026-11-20" });
  await createTask(user.id, { title: "Someday", link: { goalId: stalled.id } });
  // Cached progress and dates set directly, after createTask's recomputes.
  await prisma.goal.update({ where: { id: ahead.id }, data: { progress: 0.5 } });
  await prisma.goal.update({ where: { id: behind.id }, data: { targetDate: new Date("2026-11-11T00:00:00Z") } });
  await prisma.goal.update({ where: { id: paused.id }, data: { status: "PAUSED" } });
  return { user, ahead, onTrack, behind, stalled, paused };
}

describe("goal health on the server", () => {
  it("getDay's goal tree carries pace and stalled state, stalled first, then behind, on track, ahead", async () => {
    const s = await setup();
    const day = await getDay(s.user.id, DATE, { now: NOW });
    expect(day.goalTree.map((g) => [g.title, g.pace, g.isStalled])).toEqual([
      ["Stalled", "on_track", true],
      ["Behind", "behind", false],
      ["On track", "on_track", false],
      ["Ahead", "ahead", false],
    ]);
    expect(day.goalTree.find((g) => g.id === s.behind.id)?.expectedProgress).toBeCloseTo(0.8, 12);
  });

  it("listGoals sorts the same way; paused goals have no pace and sort last", async () => {
    const s = await setup();
    const goals = await listGoals(s.user.id, { now: NOW });
    expect(goals.map((g) => [g.title, g.pace, g.isStalled])).toEqual([
      ["Stalled", "on_track", true],
      ["Behind", "behind", false],
      ["On track", "on_track", false],
      ["Ahead", "ahead", false],
      ["Paused", null, false],
    ]);
  });

  it("getGoalDetail includes the goal's health", async () => {
    const s = await setup();
    const detail = await getGoalDetail(s.user.id, s.behind.id, { now: NOW });
    expect(detail).toMatchObject({ pace: "behind", isStalled: false });
    expect(detail.expectedProgress).toBeCloseTo(0.8, 12);
  });

  it("uses the user's local today for the stalled window", async () => {
    // 02:00 UTC on Nov 17 is still Nov 16 in New York. A step on Nov 16 is
    // today's step there; against the UTC date it would already be overdue.
    const user = await seedUser({ timezone: "America/New_York" });
    const goal = await seedGoal(user.id);
    await createTask(user.id, { title: "Step", link: { goalId: goal.id }, scheduledDate: "2026-11-16" });
    const [lateEvening] = await listGoals(user.id, { now: new Date("2026-11-17T02:00:00Z") });
    expect(lateEvening?.isStalled).toBe(false);
    const [nextMorning] = await listGoals(user.id, { now: new Date("2026-11-17T14:00:00Z") });
    expect(nextMorning?.isStalled).toBe(true);
  });
});

describe("findNextStep", () => {
  it("returns the first TODO task of the first open milestone", async () => {
    const user = await seedUser();
    const goal = await seedGoal(user.id);
    const done = await seedMilestone(user.id, goal.id);
    const open = await seedMilestone(user.id, goal.id);
    const later = await seedMilestone(user.id, goal.id);
    await createTask(user.id, { title: "Old", link: { milestoneId: done.id } });
    await prisma.milestone.update({ where: { id: done.id }, data: { status: "DONE" } });
    const finished = await createTask(user.id, { title: "Finished", link: { milestoneId: open.id } });
    await prisma.task.update({ where: { id: finished.id }, data: { status: "DONE" } });
    const first = await createTask(user.id, { title: "First open", link: { milestoneId: open.id }, scheduledDate: "2026-12-01" });
    await createTask(user.id, { title: "Second open", link: { milestoneId: open.id } });
    await createTask(user.id, { title: "Later", link: { milestoneId: later.id } });

    const step = await findNextStep(user.id, goal.id);
    expect(step).toMatchObject({ kind: "task", task: { id: first.id, title: "First open", scheduledDate: "2026-12-01" } });
  });

  it("asks for a task in the first open milestone when it has none to do", async () => {
    const user = await seedUser();
    const goal = await seedGoal(user.id);
    const open = await seedMilestone(user.id, goal.id);
    expect(await findNextStep(user.id, goal.id)).toEqual({
      kind: "create",
      goalId: goal.id,
      milestone: { id: open.id, title: open.title },
    });
  });

  it("asks for a task on the goal when no milestone is open", async () => {
    const user = await seedUser();
    const goal = await seedGoal(user.id);
    expect(await findNextStep(user.id, goal.id)).toEqual({ kind: "create", goalId: goal.id, milestone: null });
  });

  it("throws NotFound for another user's goal", async () => {
    const user = await seedUser();
    const goal = await seedGoal(user.id);
    const other = await seedUser();
    await expect(findNextStep(other.id, goal.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
