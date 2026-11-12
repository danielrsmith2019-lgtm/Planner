"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { goalShades, isGoalColor } from "@/lib/domain/goal-colors";
import { goalStatusActions, STATUS_LABEL } from "@/lib/domain/goal-status";
import type { GoalStatus } from "@/lib/domain/stalled";
import type { GoalSummary } from "@/services/day";
import { Icon } from "@/utils/icons";
import GoalProgressWidget from "./GoalProgressWidget";

type GoalCardProps = {
  goal: GoalSummary;
  onStatusChange: (goal: GoalSummary, status: GoalStatus) => void;
  /** Stalled goals: "Schedule" in the insight row. */
  onScheduleNextStep?: (goal: GoalSummary) => void;
  scheduling?: boolean;
};

function StatusPill({ status, color }: { status: GoalStatus; color: string }) {
  const shades = isGoalColor(color) ? goalShades(color) : null;
  const style =
    status === "ACTIVE" && shades !== null
      ? { background: shades.light, color: shades.dark }
      : status === "COMPLETED"
        ? { background: "var(--color-bc-green-light)", color: "var(--color-bc-green-dark)" }
        : { background: "var(--color-surface-alt)", color: "var(--color-fg-secondary)" };
  return (
    <span className="bc-pill" style={style}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function GoalCard({ goal, onStatusChange, onScheduleNextStep, scheduling = false }: GoalCardProps) {
  const inactive = goal.status !== "ACTIVE";
  const actions = goalStatusActions(goal.status);
  const firstDestructive = actions.findIndex((a) => a.destructive === true);
  const metric =
    goal.progressMode === "METRIC" && goal.metricTarget !== null
      ? { current: goal.metricCurrent, target: goal.metricTarget, unit: goal.metricUnit ?? "" }
      : null;

  return (
    <GoalProgressWidget
      size="card"
      className="bento-half"
      goalId={goal.id}
      title={goal.title}
      color={goal.color}
      progress={goal.progress}
      pace={goal.pace}
      isStalled={goal.isStalled}
      nextMilestone={goal.nextMilestone?.title ?? null}
      metric={metric}
      href={`/goals/${goal.id}`}
      dimmed={inactive}
      // Active goals show their pace; the others show their status.
      badge={inactive ? <StatusPill status={goal.status} color={goal.color} /> : undefined}
      onSchedule={onScheduleNextStep === undefined ? undefined : () => onScheduleNextStep(goal)}
      scheduling={scheduling}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${goal.title}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-fg-secondary hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-bc-blue"
          >
            <Icon icon="more" size={20} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map((action, index) => (
              <div key={action.to}>
                {index === firstDestructive && index > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  variant={action.destructive === true ? "destructive" : "default"}
                  onSelect={() => onStatusChange(goal, action.to)}
                >
                  <Icon icon={action.icon} size={18} />
                  {action.label}
                </DropdownMenuItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
}
