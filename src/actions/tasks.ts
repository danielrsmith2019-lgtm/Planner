"use server";

import { z } from "zod";
import type { CarryOverResolution, CarryOverResult, CompletionResult, UnfinishedTasks } from "@/services/tasks";
import {
  carryOverTasks,
  completeTask,
  createTask,
  getUnfinishedTasks,
  logProgress,
  resolveCarryOver,
  scheduleTask,
  setTaskLink,
  uncompleteTask,
  updateTask,
} from "@/services/tasks";
import type { TaskDTO } from "@/services/mappers";
import { runAction } from "./result";
import {
  carryOverInput,
  createTaskInput,
  logProgressInput,
  resolveCarryOverInput,
  updateTaskInput,
  scheduleTaskInput,
  setTaskLinkInput,
  taskIdInput,
} from "./schemas";
import type { ActionResult } from "./types";

export async function completeTaskAction(input: { taskId: string }): Promise<ActionResult<CompletionResult>> {
  return runAction(taskIdInput, input, (user, { taskId }) => completeTask(user.id, taskId));
}

export async function uncompleteTaskAction(input: { taskId: string }): Promise<ActionResult<CompletionResult>> {
  return runAction(taskIdInput, input, (user, { taskId }) => uncompleteTask(user.id, taskId));
}

export async function createTaskAction(input: unknown): Promise<ActionResult<TaskDTO>> {
  return runAction(createTaskInput, input, (user, data) => createTask(user.id, data));
}

export async function scheduleTaskAction(input: unknown): Promise<ActionResult<TaskDTO>> {
  return runAction(scheduleTaskInput, input, (user, { taskId, ...rest }) => scheduleTask(user.id, taskId, rest));
}

export async function setTaskLinkAction(input: unknown): Promise<ActionResult<CompletionResult>> {
  return runAction(setTaskLinkInput, input, (user, { taskId, link }) => setTaskLink(user.id, taskId, link));
}

export async function carryOverTasksAction(input: unknown): Promise<ActionResult<CarryOverResult>> {
  return runAction(carryOverInput, input, (user, { fromDate, toDate, taskIds }) =>
    carryOverTasks(user.id, fromDate, toDate, taskIds),
  );
}

/** Metric goals: create an already-DONE task carrying the amount. */
export async function logProgressAction(input: unknown): Promise<ActionResult<CompletionResult>> {
  return runAction(logProgressInput, input, (user, { goalId, amount, title }) =>
    logProgress(user.id, goalId, { amount, title }),
  );
}

/** TODO tasks scheduled before the user's today (the carry-over banner). */
export async function getUnfinishedTasksAction(): Promise<ActionResult<UnfinishedTasks>> {
  return runAction(z.undefined(), undefined, (user) => getUnfinishedTasks(user.id));
}

/** Keep (to today), reschedule or drop (SKIPPED) each unfinished task. */
export async function resolveCarryOverAction(input: unknown): Promise<ActionResult<CarryOverResolution>> {
  return runAction(resolveCarryOverInput, input, (user, decisions) => resolveCarryOver(user.id, decisions));
}

/** The edit sheet: title, link, day, duration and Top 3 in one call. */
export async function updateTaskAction(input: unknown): Promise<ActionResult<TaskDTO>> {
  return runAction(updateTaskInput, input, (user, { taskId, ...rest }) => updateTask(user.id, taskId, rest));
}
