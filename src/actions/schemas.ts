import { z } from "zod";
import { GOAL_COLORS } from "@/lib/domain/goal-colors";

/**
 * Input schemas for the Server Actions. They check shape and ranges at the
 * boundary; the services still enforce the business rules (5 active goals,
 * milestone -> goal link, journal versions).
 */

export const idSchema = z.string().trim().min(1).max(64);
export const localDateSchema = z.iso.date({ error: "Use a YYYY-MM-DD date." });
const minuteOfDay = z.number().int().min(0).max(1439);
const duration = z.number().int().min(1).max(1440);
const title = z.string().trim().min(1, "A title is required.").max(200);

export const taskIdInput = z.object({ taskId: idSchema });

export const taskLinkSchema = z.union([
  z.object({ milestoneId: idSchema }).strict(),
  z.object({ goalId: idSchema }).strict(),
]);

export const createTaskInput = z.object({
  title,
  notes: z.string().max(5000).nullish(),
  link: taskLinkSchema.nullish(),
  scheduledDate: localDateSchema.nullish(),
  startMin: minuteOfDay.nullish(),
  durationMin: duration.nullish(),
  contribution: z.number().finite().min(-1_000_000).max(1_000_000).nullish(),
  isTopThree: z.boolean().optional(),
  rank: z.string().min(1).max(64).optional(),
});

export const scheduleTaskInput = z.object({
  taskId: idSchema,
  scheduledDate: localDateSchema.nullable(),
  startMin: minuteOfDay.nullable(),
  durationMin: duration.nullable(),
  rank: z.string().min(1).max(64),
});

export const setTaskLinkInput = z.object({ taskId: idSchema, link: taskLinkSchema.nullable() });

export const carryOverInput = z.object({
  fromDate: localDateSchema,
  toDate: localDateSchema,
  taskIds: z.array(idSchema).max(200),
});

export const createGoalInput = z.object({
  title,
  why: z.string().max(2000).nullish(),
  color: z.enum(GOAL_COLORS).optional(),
  progressMode: z.enum(["MILESTONES", "METRIC"]),
  metricUnit: z.string().trim().max(20).nullish(),
  metricTarget: z.number().positive().max(1_000_000_000).nullish(),
  startDate: localDateSchema,
  targetDate: localDateSchema.nullish(),
});

export const goalIdInput = z.object({ goalId: idSchema });

export const setGoalStatusInput = z.object({
  goalId: idSchema,
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]),
});

export const createMilestoneInput = z.object({
  goalId: idSchema,
  title,
  description: z.string().max(2000).nullish(),
  weight: z.number().int().min(1).max(3).optional(),
  targetDate: localDateSchema.nullish(),
});

export const dateInput = z.object({ date: localDateSchema });

export const saveJournalInput = z.object({
  date: localDateSchema,
  content: z.looseObject({ type: z.literal("doc") }),
  version: z.number().int().min(0),
  intention: z.string().max(500).nullish(),
  mood: z.number().int().min(1).max(5).nullish(),
});

export const updateMilestoneInput = z
  .object({
    milestoneId: idSchema,
    rank: z.string().regex(/^[0-9a-z]{1,64}$/).optional(),
    weight: z.number().int().min(1).max(3).optional(),
  })
  .refine((v) => v.rank !== undefined || v.weight !== undefined, { error: "Nothing to change." });

export const setMilestoneStatusInput = z.object({ milestoneId: idSchema, status: z.enum(["OPEN", "DONE"]) });

export const logProgressInput = z.object({
  goalId: idSchema,
  amount: z.number({ error: "Enter an amount." }).finite().positive("Enter an amount above 0.").max(1_000_000),
  title: z.string().trim().max(200).nullish(),
});

export const resolveCarryOverInput = z.object({
  keep: z.array(idSchema).max(200),
  reschedule: z.array(z.object({ taskId: idSchema, date: localDateSchema })).max(200),
  drop: z.array(idSchema).max(200),
});
