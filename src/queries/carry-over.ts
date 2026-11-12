import { queryOptions } from "@tanstack/react-query";
import { getUnfinishedTasksAction } from "@/actions/tasks";
import { unwrap } from "@/actions/types";
import type { UnfinishedTasks } from "@/services/tasks";
import { queryKeys } from "./keys";

export async function getUnfinished(): Promise<UnfinishedTasks> {
  return unwrap(await getUnfinishedTasksAction());
}

export const carryOverQuery = () => queryOptions({ queryKey: queryKeys.carryOver(), queryFn: getUnfinished });
