import type { LocalDate } from "@/lib/domain/dates";
import type { CarryOverDecisions } from "@/services/tasks";

/** One unfinished task's choice in the carry-over sheet. */
export type CarryChoice = { action: "keep" } | { action: "reschedule"; date: LocalDate } | { action: "drop" };

/** Turn the sheet's per-task choices into one resolveCarryOver call. */
export function buildCarryOverDecisions(choices: ReadonlyMap<string, CarryChoice>): CarryOverDecisions {
  const keep: string[] = [];
  const reschedule: { taskId: string; date: LocalDate }[] = [];
  const drop: string[] = [];
  for (const [taskId, choice] of choices) {
    if (choice.action === "keep") keep.push(taskId);
    else if (choice.action === "drop") drop.push(taskId);
    else reschedule.push({ taskId, date: choice.date });
  }
  return { keep, reschedule, drop };
}

export function summarizeChoices(choices: ReadonlyMap<string, CarryChoice>): string {
  const d = buildCarryOverDecisions(choices);
  const parts = [
    d.keep.length > 0 ? `keep ${d.keep.length}` : null,
    d.reschedule.length > 0 ? `move ${d.reschedule.length}` : null,
    d.drop.length > 0 ? `drop ${d.drop.length}` : null,
  ].filter((p): p is string => p !== null);
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
