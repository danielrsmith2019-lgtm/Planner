"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type { LocalDate } from "@/lib/domain/dates";
import { formatMonth, monthGrid, monthOf, moodFor, MOODS, shiftMonth } from "@/lib/domain/journal";
import { journalMonthQuery } from "@/queries/journal";
import { useUiStore } from "@/stores/ui";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** /journal: a month calendar with a dot on days that have an entry, colored by mood. */
export default function JournalCalendar() {
  const today = useUiStore((s) => s.today);
  if (today === null) return <div className="bc-card bc-skeleton h-80" aria-hidden="true" />;
  return <Calendar today={today} />;
}

function Calendar({ today }: { today: LocalDate }) {
  const [month, setMonth] = useState(() => monthOf(today));
  const days = useQuery(journalMonthQuery(month));
  const byDate = new Map((days.data ?? []).map((d) => [d.date, d]));

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Link href={`/journal/${today}`} className="bc-btn-primary min-h-11">
        <Icon icon="journal" size={18} />
        Write today&apos;s entry
      </Link>

      <section className="bc-card px-3 py-3" aria-labelledby="calendar-month">
        <div className="mb-2 flex items-center gap-1">
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month" className="flex size-11 items-center justify-center rounded-full text-fg-secondary hover:bg-surface-alt">
            <Icon icon="previous" size={20} />
          </button>
          <h2 id="calendar-month" aria-live="polite" className="flex-1 text-center text-[17px] font-semibold text-fg">
            {formatMonth(month)}
          </h2>
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month" className="flex size-11 items-center justify-center rounded-full text-fg-secondary hover:bg-surface-alt">
            <Icon icon="next" size={20} />
          </button>
        </div>

        <table className="w-full table-fixed border-collapse" aria-busy={days.isPending}>
          <thead>
            <tr>
              {WEEKDAYS.map((d, i) => (
                <th key={WEEKDAY_NAMES[i]} scope="col" abbr={WEEKDAY_NAMES[i]} className="pb-1 text-[11px] font-semibold text-fg-tertiary">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid(month).map((week) => (
              <tr key={week[0]?.date}>
                {week.map(({ date, inMonth }) => {
                  const entry = byDate.get(date);
                  const mood = moodFor(entry?.mood ?? null);
                  const isToday = date === today;
                  const day = Number(date.slice(8));
                  const description = entry === undefined ? "no entry" : mood === null ? "entry" : `entry, mood ${mood.label}`;
                  return (
                    <td key={date} className="p-0.5 text-center">
                      <Link
                        href={`/journal/${date}`}
                        aria-label={`${date}, ${description}`}
                        className={cn(
                          "mx-auto flex h-12 max-w-12 flex-col items-center justify-center gap-1 rounded-[12px] text-[15px] tabular-nums hover:bg-surface-alt",
                          inMonth ? "text-fg" : "text-fg-tertiary",
                          isToday && "bg-bc-blue-light font-semibold text-bc-blue",
                        )}
                      >
                        {day}
                        <span
                          className={cn("size-1.5 rounded-full", entry === undefined && "invisible")}
                          style={{ background: mood?.color ?? "var(--color-fg-tertiary)" }}
                          aria-hidden="true"
                        />
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1" aria-label="Mood colors">
        {MOODS.map((mood) => (
          <li key={mood.value} className="bc-caption flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: mood.color }} aria-hidden="true" />
            {mood.label}
          </li>
        ))}
        <li className="bc-caption flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-fg-tertiary" aria-hidden="true" />
          No mood
        </li>
      </ul>
    </div>
  );
}
