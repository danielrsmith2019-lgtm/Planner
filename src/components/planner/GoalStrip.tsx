"use client";

import Link from "next/link";
import GoalProgressWidget, { type GoalMetric } from "@/components/goals/GoalProgressWidget";
import type { GoalNode } from "@/lib/domain/goal-tree";
import { Icon } from "@/utils/icons";

/** "Next: ..." for a goal: its first open milestone, in rank order. */
export function nextMilestoneTitle(goal: GoalNode): string | null {
  return goal.milestones.find((m) => m.status === "OPEN")?.title ?? null;
}

export function goalMetric(goal: Pick<GoalNode, "progressMode" | "metricCurrent" | "metricTarget" | "metricUnit">): GoalMetric | null {
  if (goal.progressMode !== "METRIC" || goal.metricTarget === null) return null;
  return { current: goal.metricCurrent, target: goal.metricTarget, unit: goal.metricUnit ?? "" };
}

type GoalStripProps = {
  /** In health order from the server: stalled, behind, on track, ahead. */
  goals: GoalNode[];
  onScheduleNextStep: (goalId: string) => void;
  /** The goal whose next step is loading. */
  schedulingGoalId: string | null;
};

/**
 * Active goals on Today, as GoalProgressWidgets.
 * Phones: a strip of 48px rings, then one insight row for the first stalled goal.
 * 768px up: the Goals rail, one card per goal (pace pill, "Next: ...", and
 * "Schedule" on stalled goals). Rings animate after a completion.
 */
export default function GoalStrip({ goals, onScheduleNextStep, schedulingGoalId }: GoalStripProps) {
  const active = goals.filter((g) => g.status === "ACTIVE");
  if (active.length === 0) {
    return (
      <Link href="/goals" className="bc-card bc-label flex min-h-11 items-center md:block">
        No active goals yet. Add one on the Goals page.
      </Link>
    );
  }
  const stalled = active.filter((g) => g.isStalled);
  const firstStalled = stalled[0];

  return (
    <nav aria-label="Goals">
      {/* Phones: horizontal scroll, then the first stalled goal's insight row. */}
      <div className="bc-card flex flex-col gap-2 px-3 pt-1 pb-3 md:hidden">
        {/* Top padding leaves room for the "+N%" label inside the scroll box. */}
        <ul className="-mx-3 flex gap-3 overflow-x-auto px-3 pt-3">
          {active.map((goal) => (
            <li key={goal.id} className="shrink-0">
              <GoalProgressWidget
                size="strip"
                goalId={goal.id}
                title={goal.title}
                color={goal.color}
                progress={goal.progress}
                pace={goal.pace}
                isStalled={goal.isStalled}
                href={`/goals/${goal.id}`}
              />
            </li>
          ))}
        </ul>
        {firstStalled !== undefined && (
          <div className="flex items-center gap-2.5 rounded-[12px] bg-surface-alt py-0.5 pr-0.5 pl-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-bc-orange-light text-stalled">
              <Icon icon="stalled" size={16} />
            </span>
            <p className="min-w-0 flex-1 py-2 text-[13px] leading-snug text-fg">
              <span className="font-semibold">{firstStalled.title}</span>: no step scheduled this week
              {stalled.length > 1 && <span className="text-fg-secondary"> (+{stalled.length - 1} more)</span>}
            </p>
            <button
              type="button"
              onClick={() => onScheduleNextStep(firstStalled.id)}
              disabled={schedulingGoalId !== null}
              aria-label={`Schedule next step for ${firstStalled.title}`}
              className="group flex min-h-11 shrink-0 items-center px-1.5 disabled:opacity-60"
            >
              <span className="rounded-full bg-bc-blue px-3 py-1.5 text-[13px] font-semibold text-white">
                {schedulingGoalId === firstStalled.id ? "Finding..." : "Schedule"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* 768px up: the Goals rail. */}
      <ul className="hidden flex-col gap-3 md:flex">
        {active.map((goal) => (
          <li key={goal.id}>
            <GoalProgressWidget
              size="card"
              goalId={goal.id}
              title={goal.title}
              color={goal.color}
              progress={goal.progress}
              pace={goal.pace}
              isStalled={goal.isStalled}
              nextMilestone={nextMilestoneTitle(goal)}
              metric={goalMetric(goal)}
              href={`/goals/${goal.id}`}
              onSchedule={() => onScheduleNextStep(goal.id)}
              scheduling={schedulingGoalId === goal.id}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
