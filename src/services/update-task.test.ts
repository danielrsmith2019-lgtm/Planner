import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedGoal, seedMilestone, seedUser } from "../../test/seed";
import { ValidationError } from "./errors";
import { completeTask, createTask, updateTask } from "./tasks";

describe("updateTask", () => {
  it("edits title and duration, keeping the time when the day doesn't change", async () => {
    const user = await seedUser();
    const task = await createTask(user.id, { title: "Draft", scheduledDate: "2026-11-12", startMin: 540 });
    const updated = await updateTask(user.id, task.id, { title: " Draft intro ", durationMin: 45, scheduledDate: "2026-11-12" });
    expect(updated).toMatchObject({ title: "Draft intro", durationMin: 45, startMin: 540, scheduledDate: "2026-11-12" });
  });

  it("moving to another day clears the time and appends; null sends it to the backlog", async () => {
    const user = await seedUser();
    const other = await createTask(user.id, { title: "Already there", scheduledDate: "2026-11-13" });
    const task = await createTask(user.id, { title: "Move me", scheduledDate: "2026-11-12", startMin: 540 });
    const moved = await updateTask(user.id, task.id, { scheduledDate: "2026-11-13" });
    expect(moved).toMatchObject({ scheduledDate: "2026-11-13", startMin: null });
    expect(moved.rank > other.rank).toBe(true);
    const backlog = await updateTask(user.id, task.id, { scheduledDate: null, isTopThree: true });
    expect(backlog).toMatchObject({ scheduledDate: null, isTopThree: false });
  });

  it("relinks to a milestone and recomputes both sides", async () => {
    const user = await seedUser();
    const goal = await seedGoal(user.id);
    const a = await seedMilestone(user.id, goal.id);
    const b = await seedMilestone(user.id, goal.id);
    const task = await createTask(user.id, { title: "Task", link: { milestoneId: a.id }, scheduledDate: "2026-11-12" });
    await completeTask(user.id, task.id);
    expect((await prisma.milestone.findUniqueOrThrow({ where: { id: a.id } })).progress).toBe(0.95);
    const moved = await updateTask(user.id, task.id, { link: { milestoneId: b.id } });
    expect(moved).toMatchObject({ milestoneId: b.id, goalId: goal.id });
    expect((await prisma.milestone.findUniqueOrThrow({ where: { id: a.id } })).progress).toBe(0);
    expect((await prisma.milestone.findUniqueOrThrow({ where: { id: b.id } })).progress).toBe(0.95);
  });

  it("keeps the Top 3 limit", async () => {
    const user = await seedUser();
    for (const n of [1, 2, 3]) await createTask(user.id, { title: `T${n}`, scheduledDate: "2026-11-12", isTopThree: true });
    const task = await createTask(user.id, { title: "Fourth", scheduledDate: "2026-11-12" });
    await expect(updateTask(user.id, task.id, { isTopThree: true })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateTask(user.id, task.id, { title: "" })).rejects.toBeInstanceOf(ValidationError);
  });
});
