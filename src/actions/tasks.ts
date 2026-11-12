"use server";

import type { CarryOverResult, CompletionResult } from "@/services/tasks";
import {
  carryOverTasks,
  completeTask,
  createTask,
  scheduleTask,
  setTaskLink,
  uncompleteTask,
} from "@/services/tasks";
import type { TaskDTO } from "@/services/mappers";
import { runAction } from "./result";
import {
  carryOverInput,
  createTaskInput,
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
