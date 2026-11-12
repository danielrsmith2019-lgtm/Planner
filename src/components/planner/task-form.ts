import { addDays, toDayNumber, type LocalDate } from "@/lib/domain/dates";
import type { DayTask, GoalNode } from "@/lib/domain/goal-tree";
import type { NewTaskValues } from "@/hooks/useTaskMutations";

/**
 * TaskForm's pure parts: the link picker's search and the conversion to the
 * createTask input. Unit-tested; the server re-checks everything.
 */

export type LinkOption =
  | { kind: "goal"; goalId: string; label: string; color: string }
  | { kind: "milestone"; goalId: string; milestoneId: string; label: string; goalTitle: string; color: string };

/**
 * Goals and their open milestones matching the query (case-insensitive, on
 * the goal or milestone title). A milestone carries its goal, so choosing it
 * sets both. Empty query lists everything.
 */
export function searchLinkOptions(goals: readonly GoalNode[], query: string, limit = 12): LinkOption[] {
  const q = query.trim().toLowerCase();
  const matches = (text: string) => q === "" || text.toLowerCase().includes(q);
  const options: LinkOption[] = [];
  for (const goal of goals) {
    if (goal.status !== "ACTIVE") continue;
    const goalMatches = matches(goal.title);
    if (goalMatches) options.push({ kind: "goal", goalId: goal.id, label: goal.title, color: goal.color });
    for (const m of goal.milestones) {
      if (m.status !== "OPEN") continue;
      if (goalMatches || matches(m.title)) {
        options.push({ kind: "milestone", goalId: goal.id, milestoneId: m.id, label: m.title, goalTitle: goal.title, color: goal.color });
      }
    }
  }
  return options.slice(0, limit);
}

export type DateChoice = "today" | "tomorrow" | "pick" | "backlog";

export type TaskFormState = {
  title: string;
  link: LinkOption | null;
  dateChoice: DateChoice;
  pickedDate: string;
  durationMin: number;
  isTopThree: boolean;
  /** True once the user changes the link (edit only sends the link then). */
  linkChanged: boolean;
};

/** Start on the day being viewed: Today, Tomorrow, or that date picked. */
export function initialTaskForm(today: LocalDate, viewing: LocalDate, isTopThree = false): TaskFormState {
  const dateChoice: DateChoice = viewing === today ? "today" : viewing === addDays(today, 1) ? "tomorrow" : "pick";
  return { title: "", link: null, dateChoice, pickedDate: viewing, durationMin: 30, isTopThree, linkChanged: false };
}

/** The link picker's option for a task's current goal / milestone, if it's in the tree. */
export function linkOptionFor(goals: readonly GoalNode[], task: Pick<DayTask, "goalId" | "milestoneId">): LinkOption | null {
  const goal = goals.find((g) => g.id === task.goalId);
  if (goal === undefined) return null;
  const milestone = goal.milestones.find((m) => m.id === task.milestoneId);
  if (milestone !== undefined) {
    return { kind: "milestone", goalId: goal.id, milestoneId: milestone.id, label: milestone.title, goalTitle: goal.title, color: goal.color };
  }
  return { kind: "goal", goalId: goal.id, label: goal.title, color: goal.color };
}

/** Edit: the form filled from an existing task. */
export function taskFormFromTask(task: DayTask, today: LocalDate, goals: readonly GoalNode[]): TaskFormState {
  const date = task.scheduledDate;
  const dateChoice: DateChoice =
    date === null ? "backlog" : date === today ? "today" : date === addDays(today, 1) ? "tomorrow" : "pick";
  return {
    title: task.title,
    link: linkOptionFor(goals, task),
    dateChoice,
    pickedDate: date ?? today,
    durationMin: task.durationMin ?? 30,
    isTopThree: task.isTopThree,
    linkChanged: false,
  };
}

export function resolveDate(state: TaskFormState, today: LocalDate): LocalDate | null {
  switch (state.dateChoice) {
    case "today":
      return today;
    case "tomorrow":
      return addDays(today, 1);
    case "backlog":
      return null;
    case "pick":
      return state.pickedDate;
  }
}

export type TaskFormErrors = { title?: string; date?: string };

export function validateTaskForm(
  state: TaskFormState,
  today: LocalDate,
): { ok: true; values: NewTaskValues } | { ok: false; errors: TaskFormErrors } {
  const errors: TaskFormErrors = {};
  const title = state.title.trim();
  if (title === "") errors.title = "What's the task?";
  else if (title.length > 200) errors.title = "Keep it under 200 characters.";
  const date = resolveDate(state, today);
  if (date !== null) {
    try {
      toDayNumber(date);
    } catch {
      errors.date = "Pick a date.";
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    values: {
      title,
      link:
        state.link === null
          ? null
          : state.link.kind === "milestone"
            ? { milestoneId: state.link.milestoneId }
            : { goalId: state.link.goalId },
      scheduledDate: date,
      durationMin: state.durationMin,
      // Backlog tasks can't be Top 3; the toggle is off there anyway.
      isTopThree: date !== null && state.isTopThree,
    },
  };
}
