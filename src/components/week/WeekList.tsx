"use client";

import { useState } from "react";
import type { LocalDate } from "@/lib/domain/dates";
import type { DayTask } from "@/lib/domain/goal-tree";
import { dayHeader } from "@/lib/domain/week";
import { dayStats, type WeekData } from "@/lib/domain/week-board";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";
import { WeekTaskCardBody } from "./WeekTaskCard";

/**
 * Phone week (<768px): one section per day with "MON 3" headers. Today
 * starts expanded (Monday when this week doesn't include today); tapping a
 * task opens its sheet, which has "Move to..." instead of drag.
 */
export default function WeekList({
  week,
  today,
  onOpenTask,
  onAddTask,
}: {
  week: WeekData;
  today: LocalDate;
  onOpenTask: (task: DayTask) => void;
  onAddTask: (date: LocalDate) => void;
}) {
  const initial = week.days.some((d) => d.date === today) ? today : week.startDate;
  const [open, setOpen] = useState<Set<string>>(() => new Set([initial]));
  const goalById = new Map(week.goalTree.map((g) => [g.id, g]));
  const toggle = (date: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  return (
    <div className="flex flex-col gap-2">
      {week.days.map((day) => {
        const header = dayHeader(day.date);
        const stats = dayStats(day, week.goalTree);
        const expanded = open.has(day.date);
        const isToday = day.date === today;
        const panelId = `week-day-${day.date}`;
        return (
          <section key={day.date} className={cn("bc-card p-0", isToday && "border-bc-blue/40")}>
            <h2>
              <button
                type="button"
                onClick={() => toggle(day.date)}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="flex min-h-14 w-full items-center gap-2 px-4 text-left"
              >
                <span className={cn("text-[13px] font-semibold tracking-wide", isToday ? "text-bc-blue" : "text-fg-secondary")}>
                  {header.weekday}
                </span>
                <span className={cn("bc-data text-[17px]", isToday ? "text-bc-blue" : "text-fg")}>{header.day}</span>
                {isToday && <span className="bc-pill bg-bc-blue-light text-bc-blue">Today</span>}
                <span className="bc-caption ml-auto">
                  {stats.total === 0 ? "No tasks" : `${stats.done}/${stats.total} done`}
                </span>
                <Icon icon="expand" size={18} className={cn("shrink-0 text-fg-tertiary transition-transform", expanded && "rotate-180")} />
              </button>
            </h2>
            {expanded && (
              <div id={panelId} className="flex flex-col gap-1.5 border-t border-border px-3 pt-2.5 pb-2">
                {day.tasks.map((task) => (
                  <button key={task.id} type="button" onClick={() => onOpenTask(task)} className="block w-full">
                    <WeekTaskCardBody task={task} goalColor={task.goalId === null ? undefined : goalById.get(task.goalId)?.color} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onAddTask(day.date)}
                  className="flex min-h-11 items-center gap-1 rounded-[10px] px-1 text-[14px] font-medium text-bc-blue"
                >
                  <Icon icon="add" size={16} />
                  Add task
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
