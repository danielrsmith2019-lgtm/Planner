import type { CreateGoalValues } from "@/hooks/useGoalMutations";
import { toDayNumber, type LocalDate } from "@/lib/domain/dates";

/**
 * GoalForm's state and its conversion to the createGoal input. Pure, so the
 * checks are unit-tested. The server re-validates everything (Zod schema and
 * createGoal); these checks only save a round trip for obvious mistakes.
 */

export type GoalFormState = {
  title: string;
  why: string;
  progressMode: "MILESTONES" | "METRIC";
  metricUnit: string;
  /** Raw text from the number input. */
  metricTarget: string;
  color: string;
  startDate: LocalDate;
  targetDate: string;
};

export type GoalFormErrors = Partial<Record<keyof GoalFormState, string>>;

export function initialGoalForm(today: LocalDate, color: string): GoalFormState {
  return {
    title: "",
    why: "",
    progressMode: "MILESTONES",
    metricUnit: "",
    metricTarget: "",
    color,
    startDate: today,
    targetDate: "",
  };
}

const isDate = (value: string) => {
  try {
    toDayNumber(value);
    return true;
  } catch {
    return false;
  }
};

export function validateGoalForm(
  state: GoalFormState,
): { ok: true; values: CreateGoalValues } | { ok: false; errors: GoalFormErrors } {
  const errors: GoalFormErrors = {};
  const title = state.title.trim();
  if (title === "") errors.title = "Give the goal a name.";
  else if (title.length > 200) errors.title = "Keep the name under 200 characters.";

  const metric = state.progressMode === "METRIC";
  const target = Number(state.metricTarget);
  if (metric) {
    if (state.metricUnit.trim() === "") errors.metricUnit = "What are you counting? For example km or books.";
    if (state.metricTarget.trim() === "" || !Number.isFinite(target) || target <= 0) {
      errors.metricTarget = "Enter a target above 0.";
    }
  }
  if (state.color === "") errors.color = "Pick a color.";
  if (!isDate(state.startDate)) errors.startDate = "Pick a start date.";
  if (state.targetDate !== "") {
    if (!isDate(state.targetDate)) errors.targetDate = "Pick a valid date.";
    else if (isDate(state.startDate) && toDayNumber(state.targetDate) < toDayNumber(state.startDate)) {
      errors.targetDate = "The target date can't be before the start date.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    values: {
      title,
      why: state.why.trim() === "" ? null : state.why.trim(),
      progressMode: state.progressMode,
      metricUnit: metric ? state.metricUnit.trim() : null,
      metricTarget: metric ? target : null,
      color: state.color,
      startDate: state.startDate,
      targetDate: state.targetDate === "" ? null : state.targetDate,
    },
  };
}

/** Server field errors (Zod) use the same keys; keep the first message per field. */
export function fromServerFieldErrors(fieldErrors: Record<string, string[]> | undefined): GoalFormErrors {
  const errors: GoalFormErrors = {};
  if (fieldErrors === undefined) return errors;
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const first = messages[0];
    if (first !== undefined && key in initialGoalForm("2026-01-01", "")) errors[key as keyof GoalFormState] = first;
  }
  return errors;
}
