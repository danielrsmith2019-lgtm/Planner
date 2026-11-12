"use client";

import { formatDayLabel } from "@/lib/domain/dates";
import { formatWeekLabel, startOfWeek } from "@/lib/domain/week";
import { useUiStore } from "@/stores/ui";
import { Icon } from "@/utils/icons";

/**
 * "< Wed, Nov 4 >" with a Today button when another day is selected. With
 * step 7 (the week view) it reads "< Nov 9 - 15 >" and offers "This week".
 */
export default function DateNav({ step }: { step: number }) {
  const selectedDate = useUiStore((s) => s.selectedDate);
  const today = useUiStore((s) => s.today);
  const shift = useUiStore((s) => s.shiftSelectedDate);
  const goToToday = useUiStore((s) => s.goToToday);

  if (selectedDate === null) return <div className="bc-skeleton h-8 w-40" aria-hidden="true" />;
  const weekly = step === 7;
  const isToday = weekly
    ? today !== null && startOfWeek(selectedDate) === startOfWeek(today)
    : selectedDate === today;
  const unit = weekly ? "week" : "day";

  return (
    <div className="flex min-w-0 items-center">
      <button
        type="button"
        onClick={() => shift(-step)}
        aria-label={`Previous ${unit}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-fg-secondary hover:bg-surface-alt hover:text-fg"
      >
        <Icon icon="previous" size={20} />
      </button>
      <h2 className="min-w-0 truncate text-center text-[15px] font-semibold tabular-nums text-fg" aria-live="polite">
        {weekly ? (
          formatWeekLabel(startOfWeek(selectedDate))
        ) : (
          <>
            <span className="sm:hidden">{isToday ? formatDayLabel(selectedDate) : formatDayLabel(selectedDate, { short: true })}</span>
            <span className="hidden sm:inline">{formatDayLabel(selectedDate)}</span>
          </>
        )}
      </h2>
      <button
        type="button"
        onClick={() => shift(step)}
        aria-label={`Next ${unit}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-fg-secondary hover:bg-surface-alt hover:text-fg"
      >
        <Icon icon="next" size={20} />
      </button>
      {!isToday && (
        <button
          type="button"
          onClick={goToToday}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-bc-blue sm:ml-1 sm:px-1"
        >
          <span className="rounded-full bg-bc-blue/10 px-2 py-1 sm:px-2.5">{weekly ? "This week" : "Today"}</span>
        </button>
      )}
    </div>
  );
}
