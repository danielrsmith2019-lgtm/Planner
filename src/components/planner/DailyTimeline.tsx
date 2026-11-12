"use client";

import { useEffect, useRef, useState } from "react";
import { getLocalMinute, minutesToLabel } from "@/lib/domain/dates";
import { goalShades, isGoalColor } from "@/lib/domain/goal-colors";
import type { DayTask, GoalNode } from "@/lib/domain/goal-tree";
import { packOverlaps } from "@/lib/domain/layout";
import { hourLabel, timelineRange } from "@/lib/domain/timeline";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";

/** 72px per hour: a 30-minute block is 36px tall. */
export const PX_PER_MIN = 1.2;
const MIN_BLOCK_PX = 24;
const GUTTER_PX = 52;

export type TimedTask = DayTask & { startMin: number };

export type DailyTimelineProps = {
  /** The day's time-blocked tasks (splitForTimeline().timed). */
  tasks: TimedTask[];
  /** For block colors and titles. */
  goals: GoalNode[];
  /** Show the now-line: true only when the selected date is today. */
  showNow: boolean;
  /** The user's timezone for the now-line; the browser's when null. */
  timezone: string | null;
  onToggle: (task: DayTask) => void;
};

function currentMinute(timezone: string | null): number {
  const now = new Date();
  if (timezone !== null) {
    try {
      return getLocalMinute(timezone, now);
    } catch {
      // Fall through to the browser's clock.
    }
  }
  return now.getHours() * 60 + now.getMinutes();
}

/** The current minute of the day, refreshed on each minute boundary. */
function useNowMinute(
  enabled: boolean,
  timezone: string | null,
): number | null {
  const [minute, setMinute] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => setMinute(currentMinute(timezone));
    tick();
    // Line up with the next minute boundary, then every 60s.
    const first = setTimeout(
      () => {
        tick();
        interval = setInterval(tick, 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => {
      clearTimeout(first);
      if (interval !== undefined) clearInterval(interval);
    };
  }, [enabled, timezone]);
  return enabled ? minute : null;
}

/**
 * The day as a vertical timeline (read-only layout; dragging comes later).
 * Overlapping blocks sit side by side via packOverlaps. Tapping a block
 * completes it. When the day is today, a blue now-line marks the time and is
 * scrolled into view (inside the timeline's own scroll box) on mount.
 */
export default function DailyTimeline({
  tasks,
  goals,
  showNow,
  timezone,
  onToggle,
}: DailyTimelineProps) {
  const nowMinute = useNowMinute(showNow, timezone);
  const { startHour, endHour } = timelineRange(tasks, nowMinute);
  const originMin = startHour * 60;
  const heightPx = (endHour - startHour) * 60 * PX_PER_MIN;
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const packed = packOverlaps(tasks);

  // The timeline scrolls inside its own box, so bringing "now" into view
  // centres it there without moving the page (Top 3 stays on screen).
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    const box = scrollRef.current;
    if (nowMinute === null || scrolled.current || box === null) return;
    scrolled.current = true;
    const lineTop = (nowMinute - originMin) * PX_PER_MIN;
    box.scrollTop = Math.max(0, lineTop - box.clientHeight / 2);
  }, [nowMinute, originMin]);

  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i,
  );

  return (
    <div
      ref={scrollRef}
      className="-mx-3 max-h-[min(62dvh,640px)] overflow-y-auto overscroll-contain px-3 pt-3"
      tabIndex={0}
      aria-label="Day timeline"
      role="region"
    >
      <div className="relative" style={{ height: heightPx + 12 }}>
        {/* Hour lines and labels */}
        {hours.map((hour) => {
          const top = (hour * 60 - originMin) * PX_PER_MIN;
          return (
            <div
              key={hour}
              className="pointer-events-none absolute inset-x-0"
              style={{ top }}
              aria-hidden="true"
            >
              <span className="absolute -top-2 left-0 w-[44px] text-right text-[11px] tabular-nums text-fg-tertiary">
                {hour < 24 ? hourLabel(hour) : ""}
              </span>
              <div className="ml-[52px] border-t border-border" />
              {hour < endHour && (
                <div
                  className="ml-[52px] border-t border-dashed border-border/70"
                  style={{ marginTop: 30 * PX_PER_MIN - 1 }}
                />
              )}
            </div>
          );
        })}

        {/* Blocks */}
        <ol
          className="absolute top-0 right-0 bottom-0"
          style={{ left: GUTTER_PX }}
          aria-label="Scheduled tasks"
        >
          {packed.map(({ task, column, columns, startMin, endMin }) => {
            const goal =
              task.goalId === null ? undefined : goalById.get(task.goalId);
            const shades =
              goal !== undefined && isGoalColor(goal.color)
                ? goalShades(goal.color)
                : null;
            const done = task.status === "DONE";
            const top = (startMin - originMin) * PX_PER_MIN;
            const height = Math.max(
              (endMin - startMin) * PX_PER_MIN,
              MIN_BLOCK_PX,
            );
            const range = `${minutesToLabel(startMin)} - ${minutesToLabel(endMin % 1440)}`;
            return (
              <li
                key={task.id}
                className="absolute pr-1 pb-0.5"
                style={{
                  top,
                  height,
                  left: `${(column / columns) * 100}%`,
                  width: `${100 / columns}%`,
                }}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`${task.title}, ${range}${goal === undefined ? "" : `, ${goal.title}`}`}
                  onClick={() => onToggle(task)}
                  className={cn(
                    "flex h-full w-full items-start gap-1.5 overflow-hidden rounded-[8px] border-l-[3px] px-2 text-left transition-opacity",
                    height >= 36 ? "py-1.5" : "items-center py-0",
                    done && "opacity-55",
                  )}
                  style={{
                    borderLeftColor:
                      goal?.color ?? "var(--color-border-strong)",
                    background: shades?.light ?? "var(--color-surface-alt)",
                    color: shades?.dark ?? "var(--color-fg)",
                  }}
                >
                  {done && (
                    <Icon
                      icon="complete"
                      size={13}
                      strokeWidth={3}
                      className="mt-[3px] shrink-0"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[13px] font-semibold leading-tight",
                        done && "line-through",
                      )}
                    >
                      {task.title}
                      {task.isTopThree && (
                        <span className="ml-1 text-[10px] font-bold tracking-wide opacity-70">
                          TOP 3
                        </span>
                      )}
                    </span>
                    {height >= 36 && (
                      <span className="block truncate text-[11px] leading-tight opacity-75">
                        {range}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Now-line */}
        {nowMinute !== null && (
          <div
            role="img"
            aria-label={`Now, ${minutesToLabel(nowMinute)}`}
            className="pointer-events-none absolute right-0 z-10 flex items-center"
            style={{
              top: (nowMinute - originMin) * PX_PER_MIN,
              left: GUTTER_PX - 6,
            }}
          >
            <span className="size-[10px] -translate-y-px rounded-full bg-bc-blue" />
            <span className="h-[2px] flex-1 bg-bc-blue" />
          </div>
        )}

        {tasks.length === 0 && (
          <p
            className="bc-caption absolute top-3 right-2 rounded-[8px] bg-surface/90 px-2 py-1"
            style={{ left: GUTTER_PX + 8 }}
          >
            Nothing time-blocked. Tasks with a start time show up here.
          </p>
        )}
      </div>
    </div>
  );
}
