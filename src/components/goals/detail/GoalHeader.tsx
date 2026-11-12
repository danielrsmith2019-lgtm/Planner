import GoalRing from "@/components/shared/GoalRing";
import Metric from "@/components/shared/Metric";
import { formatDate } from "@/lib/domain/dates";
import type { GoalDetailData } from "@/lib/domain/goal-detail";
import { STATUS_LABEL } from "@/lib/domain/goal-status";
import { Icon } from "@/utils/icons";

const formatAmount = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/**
 * 72px ring, title, why, dates and (METRIC) current / target. Stacks on phones
 * (ring beside the title, the rest below); one row from 640px.
 */
export default function GoalHeader({ goal, onLogProgress }: { goal: GoalDetailData; onLogProgress?: () => void }) {
  const metric = goal.progressMode === "METRIC";
  return (
    <section className="bc-card border-l-[3px]" style={{ borderLeftColor: goal.color }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <GoalRing progress={goal.progress} color={goal.color} size={72} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-fg">{goal.title}</h1>
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
    </section>
  );
}
