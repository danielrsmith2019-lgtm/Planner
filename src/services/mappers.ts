import "server-only";

import type { Goal, Milestone, Prisma, Task } from "@/generated/prisma/client";
import { toDayNumber, type LocalDate } from "@/lib/domain/dates";
import type { GoalStatus } from "@/lib/domain/stalled";
import type { MilestoneStatus, ProgressMode, TaskStatus } from "@/lib/domain/progress";
import { ValidationError } from "./errors";

/**
 * The service boundary: Prisma rows in, plain domain objects out.
 * DATE columns become "YYYY-MM-DD" strings (read with UTC getters, since
 * Prisma returns them as midnight UTC) and Decimal becomes number.
 */

export type TaskDTO = {
  id: string;
  goalId: string | null;
  milestoneId: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  isTopThree: boolean;
  scheduledDate: LocalDate | null;
  startMin: number | null;
  durationMin: number | null;
  contribution: number | null;
  rank: string;
  carryCount: number;
  completedAt: Date | null;
};

export type MilestoneDTO = {
  id: string;
  goalId: string;
  title: string;
  status: MilestoneStatus;
  weight: number;
  progress: number;
  targetDate: LocalDate | null;
  rank: string;
  completedAt: Date | null;
};

export type GoalDTO = {
  id: string;
  title: string;
  why: string | null;
  color: string;
  status: GoalStatus;
  progressMode: ProgressMode;
  metricUnit: string | null;
  metricTarget: number | null;
  metricCurrent: number;
  progress: number;
  startDate: LocalDate;
  targetDate: LocalDate | null;
  rank: string;
  completedAt: Date | null;
};

export function toLocalDate(value: Date): LocalDate {
  return value.toISOString().slice(0, 10);
}

export function toLocalDateOrNull(value: Date | null): LocalDate | null {
  return value === null ? null : toLocalDate(value);
}

/** "YYYY-MM-DD" -> the midnight-UTC Date Prisma expects for a DATE column. */
export function fromLocalDate(value: LocalDate): Date {
  try {
    toDayNumber(value);
  } catch {
    throw new ValidationError(`"${value}" is not a YYYY-MM-DD date.`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export function toNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

export function toNumberOrNull(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

export function toTaskDTO(task: Task): TaskDTO {
  return {
    id: task.id,
    goalId: task.goalId,
    milestoneId: task.milestoneId,
    title: task.title,
    notes: task.notes,
    status: task.status,
    isTopThree: task.isTopThree,
    scheduledDate: toLocalDateOrNull(task.scheduledDate),
    startMin: task.startMin,
    durationMin: task.durationMin,
    contribution: toNumberOrNull(task.contribution),
    rank: task.rank,
    carryCount: task.carryCount,
    completedAt: task.completedAt,
  };
}

export function toMilestoneDTO(milestone: Milestone): MilestoneDTO {
  return {
    id: milestone.id,
    goalId: milestone.goalId,
    title: milestone.title,
    status: milestone.status,
    weight: milestone.weight,
    progress: milestone.progress,
    targetDate: toLocalDateOrNull(milestone.targetDate),
    rank: milestone.rank,
    completedAt: milestone.completedAt,
  };
}

export function toGoalDTO(goal: Goal): GoalDTO {
  return {
    id: goal.id,
    title: goal.title,
    why: goal.why,
    color: goal.color,
    status: goal.status,
    progressMode: goal.progressMode,
    metricUnit: goal.metricUnit,
    metricTarget: toNumberOrNull(goal.metricTarget),
    metricCurrent: toNumber(goal.metricCurrent),
    progress: goal.progress,
    startDate: toLocalDate(goal.startDate),
    targetDate: toLocalDateOrNull(goal.targetDate),
    rank: goal.rank,
    completedAt: goal.completedAt,
  };
}
