/**
 * Seed helpers for integration tests. They use the raw client on purpose:
 * tests set up rows directly, then exercise services through forUser.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

let counter = 0;
const next = () => ++counter;

export async function seedUser(overrides: { timezone?: string; dayStartsAt?: number } = {}) {
  const n = next();
  return prisma.user.create({
    data: { authId: randomUUID(), email: `user${n}@test.dev`, ...overrides },
  });
}

export async function seedGoal(
  userId: string,
  overrides: { progressMode?: "MILESTONES" | "METRIC"; metricTarget?: number; title?: string } = {},
) {
  return prisma.goal.create({
    data: {
      userId,
      title: overrides.title ?? `Goal ${next()}`,
      progressMode: overrides.progressMode ?? "MILESTONES",
      metricTarget: overrides.metricTarget,
      metricUnit: overrides.progressMode === "METRIC" ? "km" : null,
      startDate: new Date("2026-11-01T00:00:00Z"),
      targetDate: new Date("2027-04-01T00:00:00Z"),
      rank: `a${next()}`,
    },
  });
}

export async function seedMilestone(userId: string, goalId: string, weight = 1) {
  return prisma.milestone.create({
    data: { userId, goalId, title: `Milestone ${next()}`, weight, rank: `a${next()}` },
  });
}

/** Everything a test could compare, minus updatedAt (which always moves). */
export async function dbSnapshot() {
  // Sequential on purpose: the test database is a single PGlite session.
  const tasks = await prisma.task.findMany({ orderBy: { id: "asc" } });
  const milestones = await prisma.milestone.findMany({ orderBy: { id: "asc" } });
  const goals = await prisma.goal.findMany({ orderBy: { id: "asc" } });
  const strip = <T extends { updatedAt: Date }>({ updatedAt: _updatedAt, ...rest }: T) => rest;
  return {
    tasks: tasks.map((t) => ({ ...strip(t), contribution: t.contribution?.toString() ?? null })),
    milestones: milestones.map(strip),
    goals: goals.map((g) => ({
      ...strip(g),
      metricCurrent: g.metricCurrent.toString(),
      metricTarget: g.metricTarget?.toString() ?? null,
    })),
  };
}
