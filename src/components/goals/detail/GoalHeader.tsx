import AnimatedGoalRing from "@/components/goals/AnimatedGoalRing";
import { PacePill } from "@/components/goals/GoalProgressWidget";
import Metric from "@/components/shared/Metric";
import { formatDate } from "@/lib/domain/dates";
import type { GoalDetailData } from "@/lib/domain/goal-detail";
import { STATUS_LABEL } from "@/lib/domain/goal-status";
import { Icon } from "@/utils/icons";

const formatAmount = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

type GoalHeaderProps = {
  goal: GoalDetailData;
  onLogProgress?: () => void;
  /** Stalled goals: "Schedule" in the insight row. */
  onScheduleNextStep?: () => void;
  scheduling?: boolean;
};

/**
 * 72px ring (animates after a completion), title, pace pill, dates, why and
 * (METRIC) current / target. A stalled goal adds the "No step scheduled this
 * week" row. Stacks on phones; one row from 640px.
 */
export default function GoalHeader({ goal, onLogProgress, onScheduleNextStep, scheduling = false }: GoalHeaderProps) {
  const metric = goal.progressMode === "METRIC";
  return (
    <section className="bc-card border-l-[3px]" style={{ borderLeftColor: goal.color }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <AnimatedGoalRing goalId={goal.id} progress={goal.progress} color={goal.color} size={72} stalled={goal.isStalled} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-fg">{goal.title}</h1>
            {goal.pace !== null && <PacePill pace={goal.pace} className="mt-1.5" />}
            <p className="bc-caption mt-1">
              {goal.status === "ACTIVE" ? "" : `${STATUS_LABEL[goal.status]} · `}
              Started {formatDate(goal.startDate)}
              {goal.targetDate !== null && ` · Target ${formatDate(goal.targetDate)}`}
            </p>
          </div>
        </div>
        {metric && (
          <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
            <Metric
              value={`${formatAmount(goal.metricCurrent)} / ${goal.metricTarget === null ? "?" : formatAmount(goal.metricTarget)}`}
              unit={goal.metricUnit ?? undefined}
              label="Progress"
              size="lg"
            />
            {onLogProgress !== undefined && (
              <button type="button" onClick={onLogProgress} className="bc-btn-primary min-h-11 w-auto px-4">
                <Icon icon="add" size={18} />
                Log progress
              </button>
            )}
          </div>
        )}
      </div>
      {goal.why !== null && <p className="mt-4 text-[15px] leading-relaxed text-fg-secondary">{goal.why}</p>}
      {goal.isStalled && (
        <div className="mt-4 flex items-center gap-2.5 rounded-[12px] bg-surface-alt py-0.5 pr-0.5 pl-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-bc-orange-light text-stalled">
            <Icon icon="stalled" size={16} />
          </span>
          <p className="min-w-0 flex-1 py-2 text-[13px] leading-snug text-fg">No step scheduled this week</p>
          {onScheduleNextStep !== undefined && (
            <button
              type="button"
              onClick={onScheduleNextStep}
              disabled={scheduling}
              className="group flex min-h-11 shrink-0 items-center px-1.5 disabled:opacity-60"
            >
              <span className="rounded-full bg-bc-blue px-3 py-1.5 text-[13px] font-semibold text-white">
                {scheduling ? "Finding..." : "Schedule next step"}
              </span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
