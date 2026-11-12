"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { PaceStatus } from "@/lib/domain/pace";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";
import AnimatedGoalRing from "./AnimatedGoalRing";

/**
 * GoalProgressWidget (blueprint Section 4, Prompt 4), in the light BaseCamp
 * style. Two sizes:
 *   card   white card, 4px goal-color bar, 56px ring, title, pace pill,
 *          metric line, "Next: ...", and on a stalled goal an insight row
 *          with a Schedule button. Goals rail (Today, 768px up), Goals grid.
 *   strip  48px ring with % inside and the title below, 72px wide. Today on phones.
 * The ring animates after a completion (AnimatedGoalRing).
 */

export type GoalMetric = { current: number; target: number; unit: string };

export type GoalProgressWidgetProps = {
  goalId: string;
  title: string;
  color: string;
  /** 0..1 */
  progress: number;
  pace: PaceStatus | null;
  isStalled: boolean;
  size: "strip" | "card";
  nextMilestone?: string | null;
  metric?: GoalMetric | null;
  href?: string;
  /** Stalled goals: shows the Schedule button in the insight row. */
  onSchedule?: () => void;
  /** Disables Schedule while the next step loads. */
  scheduling?: boolean;
  /** Replaces the pace pill, e.g. a Paused or Completed pill. */
  badge?: ReactNode;
  /** Top-right slot above the card link, e.g. the actions menu. */
  actions?: ReactNode;
  /** Paused or completed goals: a faded ring and title. */
  dimmed?: boolean;
  className?: string;
};

export const PACE_LABEL: Record<PaceStatus, string> = { ahead: "Ahead", on_track: "On track", behind: "Behind" };

const PACE_CLASS: Record<PaceStatus, string> = {
  ahead: "bg-bc-blue-light text-bc-blue-dark",
  on_track: "bg-bc-green-light text-bc-green-dark",
  behind: "bg-bc-orange-light text-bc-orange-dark",
};

export function PacePill({ pace, className }: { pace: PaceStatus; className?: string }) {
  return <span className={cn("bc-pill", PACE_CLASS[pace], className)}>{PACE_LABEL[pace]}</span>;
}

const formatAmount = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

function MetricLine({ metric }: { metric: GoalMetric }) {
  return (
    <span className="bc-data text-[13px] font-semibold text-fg">
      {formatAmount(metric.current)} / {formatAmount(metric.target)}
      <span className="ml-0.5 text-[11px] font-medium text-fg-tertiary">{metric.unit}</span>
    </span>
  );
}

/** Screen-reader summary; the ring already says "N% complete". */
function srSummary(pace: PaceStatus | null, isStalled: boolean): string {
  const parts = [pace === null ? null : PACE_LABEL[pace], isStalled ? "no step scheduled this week" : null];
  return parts.filter((p) => p !== null).join(", ");
}

export default function GoalProgressWidget(props: GoalProgressWidgetProps) {
  return props.size === "strip" ? <StripWidget {...props} /> : <CardWidget {...props} />;
}

function StripWidget({ goalId, title, color, progress, pace, isStalled, href, dimmed, className }: GoalProgressWidgetProps) {
  const body = (
    <>
      <AnimatedGoalRing goalId={goalId} progress={progress} color={color} size={48} stalled={isStalled} />
      <span className="w-full truncate text-center text-[11px] font-medium text-fg-secondary">{title}</span>
      <span className="sr-only">{srSummary(pace, isStalled)}</span>
    </>
  );
  const classes = cn("relative flex w-[72px] flex-col items-center gap-1 pt-1", dimmed && "opacity-60", className);
  return href === undefined ? (
    <div className={classes}>{body}</div>
  ) : (
    <Link href={href} className={cn(classes, "rounded-[12px] focus-visible:outline-2 focus-visible:outline-bc-blue")}>
      {body}
    </Link>
  );
}

function CardWidget({
  goalId,
  title,
  color,
  progress,
  pace,
  isStalled,
  nextMilestone,
  metric,
  href,
  onSchedule,
  scheduling = false,
  badge,
  actions,
  dimmed = false,
  className,
}: GoalProgressWidgetProps) {
  const pill = badge ?? (pace === null ? null : <PacePill pace={pace} />);
  return (
    <article
      className={cn("bc-card relative flex flex-col gap-3 border-l-4 py-4 pr-2", className)}
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-center gap-3.5">
        <AnimatedGoalRing
          goalId={goalId}
          progress={progress}
          color={color}
          size={56}
          stalled={isStalled}
          className={cn(dimmed && "opacity-60")}
        />
        <div className="min-w-0 flex-1">
          <h3 className={cn("line-clamp-2 text-[15px] font-semibold leading-snug text-fg", dimmed && "text-fg-secondary")}>
            {href === undefined ? (
              title
            ) : (
              // The link covers the whole card; the menu and Schedule sit above it.
              <Link
                href={href}
                className="outline-none after:absolute after:inset-0 after:rounded-[20px] focus-visible:after:outline-2 focus-visible:after:outline-bc-blue"
              >
                {title}
              </Link>
            )}
          </h3>
          <span className="sr-only">{srSummary(pace, isStalled)}</span>
          {(pill !== null || metric != null) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {pill}
              {metric != null && <MetricLine metric={metric} />}
            </div>
          )}
          {nextMilestone != null && (
            <p className="mt-1 truncate text-[13px] text-fg-secondary">Next: {nextMilestone}</p>
          )}
        </div>
        {actions !== undefined && <div className="relative z-10 self-start">{actions}</div>}
      </div>

      {isStalled && (
        // In a narrow card (the 240px rail) the button wraps under the text.
        <div className="relative z-10 flex flex-wrap items-center justify-end gap-x-2.5 rounded-[12px] bg-surface-alt py-0.5 pr-0.5 pl-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-bc-orange-light text-stalled">
            <Icon icon="stalled" size={16} />
          </span>
          <p className="min-w-[9.5rem] flex-1 py-2 text-[13px] leading-snug text-fg">No step scheduled this week</p>
          {onSchedule !== undefined && (
            <button
              type="button"
              onClick={onSchedule}
              disabled={scheduling}
              aria-label={`Schedule next step for ${title}`}
              className="group flex min-h-11 shrink-0 items-center px-1.5 disabled:opacity-60"
            >
              <span className="rounded-full bg-bc-blue px-3 py-1.5 text-[13px] font-semibold text-white group-hover:bg-bc-blue/90 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-bc-blue">
                {scheduling ? "Finding..." : "Schedule"}
              </span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}
