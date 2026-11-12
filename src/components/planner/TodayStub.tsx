"use client";

import { formatDayLabel } from "@/lib/domain/dates";
import { useUiStore } from "@/stores/ui";

/** Shows the shell's state (selected day, mode) until the real Today screen exists. */
export default function TodayStub() {
  const selectedDate = useUiStore((s) => s.selectedDate);
  const today = useUiStore((s) => s.today);
  const mode = useUiStore((s) => s.mode);
  const overridden = useUiStore((s) => s.modeOverridden);

  if (selectedDate === null) return <div className="bc-card bc-skeleton h-28" aria-hidden="true" />;

  return (
    <section className="bc-card flex flex-col gap-3">
      <span className="bc-section-label">{selectedDate === today ? "Today" : "Viewing"}</span>
      <h1 className="text-[22px] font-bold tracking-tight text-fg">{formatDayLabel(selectedDate)}</h1>
      <p className="bc-label">
        Mode: <span className="font-semibold capitalize text-fg">{mode}</span>
        {overridden ? " (picked by you)" : " (from the time of day)"}
      </p>
      <p className="bc-caption">The timeline, Top 3 and goal strip arrive in Iteration 2.</p>
    </section>
  );
}
