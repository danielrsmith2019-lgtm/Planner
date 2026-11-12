/**
 * The five goal accent colors (BaseCamp light system colors, minus blue and red,
 * which mean "accent / ahead" and "missed"). V1 caps active goals at 5.
 * Pure data: safe to import from server code, client code and Zod schemas.
 *
 * base:  rings, left accent bars, dots
 * light: tint backgrounds (pills, chips)
 * dark:  text on white (base colors are too faint for text)
 */
export const GOAL_PALETTE = [
  { base: "#34C759", light: "#E8F5E9", dark: "#2E7D32", name: "green", token: "--color-goal-1" },
  { base: "#5856D6", light: "#E8EAF6", dark: "#283593", name: "indigo", token: "--color-goal-2" },
  { base: "#AF52DE", light: "#F3E5F5", dark: "#7B1FA2", name: "purple", token: "--color-goal-3" },
  { base: "#FF9500", light: "#FFF3E0", dark: "#E65100", name: "orange", token: "--color-goal-4" },
  { base: "#5AC8FA", light: "#E0F7FA", dark: "#00838F", name: "teal", token: "--color-goal-5" },
] as const;

/** Stored in Goal.color. */
export const GOAL_COLORS = ["#34C759", "#5856D6", "#AF52DE", "#FF9500", "#5AC8FA"] as const;

export type GoalColor = (typeof GOAL_COLORS)[number];

export function isGoalColor(value: string): value is GoalColor {
  return (GOAL_COLORS as readonly string[]).includes(value);
}

/** Tint and text variants for a stored goal color. */
export function goalShades(color: GoalColor) {
  const entry = GOAL_PALETTE.find((p) => p.base === color);
  return entry ?? GOAL_PALETTE[0];
}

export type GoalPaletteEntry = (typeof GOAL_PALETTE)[number];

/**
 * Palette entries no other ACTIVE goal uses (V1: one color per active goal).
 * Pass forGoalId when editing, so a goal's own color stays available.
 */
export function freeGoalColors(
  goals: readonly { id: string; status: string; color: string }[],
  forGoalId?: string,
): GoalPaletteEntry[] {
  const used = new Set(goals.filter((g) => g.status === "ACTIVE" && g.id !== forGoalId).map((g) => g.color));
  return GOAL_PALETTE.filter((entry) => !used.has(entry.base));
}
