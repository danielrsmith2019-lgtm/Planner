"use client";

import { GOAL_COLORS } from "@/lib/domain/goal-colors";
import GoalProgressWidget, { type GoalProgressWidgetProps } from "./GoalProgressWidget";
import { ringAnimations } from "./ring-animations";

type Example = Omit<GoalProgressWidgetProps, "size"> & { delta: number };

/** The five states from blueprint Section 4, Prompt 4. */
const EXAMPLES: Example[] = [
  {
    goalId: "example-stalled",
    title: "Learn conversational Portuguese",
    color: GOAL_COLORS[2],
    progress: 0.18,
    delta: 0.04,
    pace: "behind",
    isStalled: true,
    nextMilestone: "Finish unit 4",
  },
  {
    goalId: "example-behind",
    title: "Run a sub-4 marathon",
    color: GOAL_COLORS[0],
    progress: 0.42,
    delta: 0.04,
    pace: "behind",
    isStalled: false,
    metric: { current: 212, target: 500, unit: "km" },
  },
  {
    goalId: "example-on-track",
    title: "Ship the portfolio site",
    color: GOAL_COLORS[1],
    progress: 0.6,
    delta: 0.1,
    pace: "on_track",
    isStalled: false,
    nextMilestone: "Case study pages",
  },
  {
    goalId: "example-ahead",
    title: "Read 24 books",
    color: GOAL_COLORS[3],
    progress: 0.75,
    delta: 0.04,
    pace: "ahead",
    isStalled: false,
    metric: { current: 18, target: 24, unit: "books" },
  },
  {
    goalId: "example-no-target",
    title: "Save for a trip",
    color: GOAL_COLORS[4],
    progress: 0.3,
    delta: 0.05,
    pace: null,
    isStalled: false,
    nextMilestone: "Open the savings account",
  },
];

/** Styleguide: every widget state, plus a button that plays the completion animation. */
export default function GoalWidgetExamples() {
  const play = () => {
    for (const e of EXAMPLES) ringAnimations.release(e.goalId, { from: e.progress - e.delta, to: e.progress }, false);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {EXAMPLES.map(({ delta: _delta, ...e }) => (
          <GoalProgressWidget key={e.goalId} size="card" {...e} onSchedule={() => {}} />
        ))}
      </div>
      <div className="bc-card flex gap-3 overflow-x-auto px-3 pt-4 pb-3">
        {EXAMPLES.map(({ delta: _delta, ...e }) => (
          <GoalProgressWidget key={e.goalId} size="strip" {...e} />
        ))}
      </div>
      <button type="button" onClick={play} className="bc-btn-secondary min-h-11 w-auto self-start px-4">
        Play completion animation
      </button>
    </div>
  );
}
