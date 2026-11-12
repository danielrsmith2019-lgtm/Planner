"use client";

import Link from "next/link";
import GoalRing from "@/components/shared/GoalRing";
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
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";

type GoalCardProps = {
  goal: GoalSummary;
  onStatusChange: (goal: GoalSummary, status: GoalStatus) => void;
};

const formatAmount = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

function subtitle(goal: GoalSummary): string {
  if (goal.nextMilestone !== null) return `Next: ${goal.nextMilestone.title}`;
  if (goal.progressMode === "METRIC" && goal.metricTarget !== null) {
    return `${formatAmount(goal.metricCurrent)} of ${formatAmount(goal.metricTarget)} ${goal.metricUnit ?? ""}`.trim();
  }
  return goal.milestoneCount === 0 ? "No milestones yet" : "All milestones done";
}

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

export default function GoalCard({ goal, onStatusChange }: GoalCardProps) {
  const inactive = goal.status !== "ACTIVE";
  const actions = goalStatusActions(goal.status);
  const firstDestructive = actions.findIndex((a) => a.destructive === true);

  return (
    <article
      className="bc-card bento-half relative flex items-center gap-4 border-l-[3px] py-4 pr-2"
      style={{ borderLeftColor: goal.color }}
    >
      <GoalRing
        progress={goal.progress}
        color={goal.color}
        size={56}
        className={cn("shrink-0", inactive && "opacity-60")}
      />
      <div className="min-w-0 flex-1">
        <h3 className={cn("line-clamp-2 text-[16px] font-semibold leading-snug text-fg", inactive && "text-fg-secondary")}>
          {/* The link covers the whole card; the menu button sits above it. */}
          <Link
            href={`/goals/${goal.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-[20px] focus-visible:after:outline-2 focus-visible:after:outline-bc-blue"
          >
            {goal.title}
          </Link>
        </h3>
        <p className="sr-only">
          {Math.round(goal.progress * 100)}% complete, {STATUS_LABEL[goal.status]}.
        </p>
        <p className="mt-0.5 truncate text-[13px] text-fg-secondary">{subtitle(goal)}</p>
        <div className="mt-2">
          <StatusPill status={goal.status} color={goal.color} />
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${goal.title}`}
          className="relative z-10 flex size-11 shrink-0 items-center justify-center self-start rounded-full text-fg-secondary hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-bc-blue"
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
    </article>
  );
}
