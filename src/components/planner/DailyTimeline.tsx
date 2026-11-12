"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useEffect, useRef, useState, type KeyboardEvent, type MutableRefObject } from "react";
import { getLocalMinute, minutesToLabel } from "@/lib/domain/dates";
import { goalShades, isGoalColor } from "@/lib/domain/goal-colors";
import type { DayTask, GoalNode } from "@/lib/domain/goal-tree";
import { blockEnd, packOverlaps } from "@/lib/domain/layout";
import { formatSpan, hourLabel, timelineRange } from "@/lib/domain/timeline";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";

/** 72px per hour: a 30-minute block is 36px tall. */
export const PX_PER_MIN = 1.2;
const MIN_BLOCK_PX = 24;
const GUTTER_PX = 52;

/** The single droppable: the whole grid, never one per slot. */
export const TIMELINE_DROPPABLE = "timeline";

export type TimedTask = DayTask & { startMin: number };

export type DragType = "backlog-task" | "timeline-block" | "resize-handle";
export type DragData = { type: DragType; task: DayTask };

/** What the page needs to turn a pointer position into a time. */
export type TimelineGeometry = { grid: HTMLElement | null; box: HTMLElement | null; startHour: number; endHour: number };

export type DropPreview = { startMin: number; durationMin: number };

export type DailyTimelineProps = {
  /** The day's time-blocked tasks (splitForTimeline().timed). */
  tasks: TimedTask[];
  goals: GoalNode[];
  /** Show the now-line: true only when the selected date is today. */
  showNow: boolean;
  timezone: string | null;
  onToggle: (task: DayTask) => void;
  /** Desktop only: blocks can be dragged and resized. */
  dragEnabled: boolean;
  /** Filled every render so the page can map pointer Y to minutes. */
  geometryRef: MutableRefObject<TimelineGeometry | null>;
  /** The dashed drop target while something is dragged over the grid. */
  preview: DropPreview | null;
  /** The task being dragged (dimmed in place). */
  draggingId: string | null;
  selectedId: string | null;
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
function useNowMinute(enabled: boolean, timezone: string | null): number | null {
  const [minute, setMinute] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => setMinute(currentMinute(timezone));
    tick();
    const first = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(first);
      if (interval !== undefined) clearInterval(interval);
    };
  }, [enabled, timezone]);
  return enabled ? minute : null;
}

/**
 * The day as a vertical timeline. Overlapping blocks sit side by side
 * (packOverlaps). On desktop blocks drag to a new time and resize from their
 * bottom edge; the page owns the DndContext and computes the snapped time.
 * The blue now-line shows on today and is centred in the timeline's own
 * scroll box on mount.
 */
export default function DailyTimeline({
  tasks,
  goals,
  showNow,
  timezone,
  onToggle,
  dragEnabled,
  geometryRef,
  preview,
  draggingId,
  selectedId,
}: DailyTimelineProps) {
  const nowMinute = useNowMinute(showNow, timezone);
  const { startHour, endHour } = timelineRange(tasks, nowMinute);
  const originMin = startHour * 60;
  const heightPx = (endHour - startHour) * 60 * PX_PER_MIN;
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const packed = packOverlaps(tasks);
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: TIMELINE_DROPPABLE });

  const boxRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    geometryRef.current = { grid: gridRef.current, box: boxRef.current, startHour, endHour };
  });

  const scrolled = useRef(false);
  useEffect(() => {
    const box = boxRef.current;
    if (nowMinute === null || scrolled.current || box === null) return;
    scrolled.current = true;
    const lineTop = (nowMinute - originMin) * PX_PER_MIN;
    box.scrollTop = Math.max(0, lineTop - box.clientHeight / 2);
  }, [nowMinute, originMin]);

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  return (
    <div
      ref={(node) => {
        boxRef.current = node;
        setDropRef(node);
      }}
      className={cn(
        "-mx-3 max-h-[min(62dvh,640px)] overflow-y-auto overscroll-contain px-3 pt-3 transition-colors",
        isOver && preview !== null && "bg-bc-blue-light/30",
      )}
      tabIndex={0}
      aria-label="Day timeline"
      role="region"
    >
      <div ref={gridRef} className="relative" style={{ height: heightPx + 12 }}>
        {hours.map((hour) => {
          const top = (hour * 60 - originMin) * PX_PER_MIN;
          return (
            <div key={hour} className="pointer-events-none absolute inset-x-0" style={{ top }} aria-hidden="true">
              <span className="absolute -top-2 left-0 w-[44px] text-right text-[11px] tabular-nums text-fg-tertiary">
                {hour < 24 ? hourLabel(hour) : ""}
              </span>
              <div className="ml-[52px] border-t border-border" />
              {hour < endHour && (
                <div className="ml-[52px] border-t border-dashed border-border/70" style={{ marginTop: 30 * PX_PER_MIN - 1 }} />
              )}
            </div>
          );
        })}

        <ol className="absolute top-0 right-0 bottom-0" style={{ left: GUTTER_PX }} aria-label="Scheduled tasks">
          {packed.map(({ task, column, columns, startMin, endMin }) => (
            <TimelineBlock
              key={task.id}
              task={task}
              goal={task.goalId === null ? undefined : goalById.get(task.goalId)}
              top={(startMin - originMin) * PX_PER_MIN}
              height={Math.max((endMin - startMin) * PX_PER_MIN, MIN_BLOCK_PX)}
              left={`${(column / columns) * 100}%`}
              width={`${100 / columns}%`}
              range={`${minutesToLabel(startMin)} - ${minutesToLabel(endMin % 1440)}`}
              dragEnabled={dragEnabled}
              dimmed={draggingId === task.id}
              selected={selectedId === task.id}
              onToggle={onToggle}
            />
          ))}
        </ol>

        {preview !== null && (
          <div
            className="pointer-events-none absolute right-1 z-20 flex items-start rounded-[8px] border-2 border-dashed border-bc-blue bg-bc-blue-light/70 px-2 py-1"
            style={{
              top: (preview.startMin - originMin) * PX_PER_MIN,
              height: Math.max(preview.durationMin * PX_PER_MIN, MIN_BLOCK_PX),
              left: GUTTER_PX,
            }}
            aria-hidden="true"
          >
            <span className="text-[12px] font-semibold tabular-nums text-bc-blue">
              {formatSpan(preview.startMin, preview.startMin + preview.durationMin)}
            </span>
          </div>
        )}

        {nowMinute !== null && (
          <div
            role="img"
            aria-label={`Now, ${minutesToLabel(nowMinute)}`}
            className="pointer-events-none absolute right-0 z-10 flex items-center"
            style={{ top: (nowMinute - originMin) * PX_PER_MIN, left: GUTTER_PX - 6 }}
          >
            <span className="size-[10px] -translate-y-px rounded-full bg-bc-blue" />
            <span className="h-[2px] flex-1 bg-bc-blue" />
          </div>
        )}

        {tasks.length === 0 && preview === null && (
          <p className="bc-caption absolute top-3 right-2 rounded-[8px] bg-surface/90 px-2 py-1" style={{ left: GUTTER_PX + 8 }}>
            {dragEnabled ? "Drag a task here to give it a time." : "Nothing time-blocked. Tasks with a start time show up here."}
          </p>
        )}
      </div>
    </div>
  );
}

function TimelineBlock({
  task,
  goal,
  top,
  height,
  left,
  width,
  range,
  dragEnabled,
  dimmed,
  selected,
  onToggle,
}: {
  task: TimedTask;
  goal: GoalNode | undefined;
  top: number;
  height: number;
  left: string;
  width: string;
  range: string;
  dragEnabled: boolean;
  dimmed: boolean;
  selected: boolean;
  onToggle: (task: DayTask) => void;
}) {
  const data: DragData = { type: "timeline-block", task };
  const {
    setNodeRef: setMoveRef,
    attributes: moveAttributes,
    listeners: moveListeners,
  } = useDraggable({ id: `block:${task.id}`, data, disabled: !dragEnabled });
  const resizeData: DragData = { type: "resize-handle", task };
  const {
    setNodeRef: setResizeRef,
    attributes: resizeAttributes,
    listeners: resizeListeners,
  } = useDraggable({ id: `resize:${task.id}`, data: resizeData, disabled: !dragEnabled });
  const shades = goal !== undefined && isGoalColor(goal.color) ? goalShades(goal.color) : null;
  const done = task.status === "DONE";

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onToggle(task);
      return;
    }
    moveListeners?.onKeyDown?.(event);
  };

  return (
    <li className="absolute pr-1 pb-0.5" style={{ top, height, left, width }} data-task-id={task.id}>
      <div
        ref={setMoveRef}
        {...moveAttributes}
        {...moveListeners}
        role="checkbox"
        aria-checked={done}
        aria-roledescription={dragEnabled ? "draggable block" : undefined}
        aria-label={`${task.title}, ${range}${goal === undefined ? "" : `, ${goal.title}`}`}
        onKeyDown={onKeyDown}
        onClick={() => onToggle(task)}
        className={cn(
          "group relative flex h-full w-full items-start gap-1.5 overflow-hidden rounded-[8px] border-l-[3px] px-2 text-left outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-bc-blue",
          height >= 36 ? "py-1.5" : "items-center py-0",
          dragEnabled ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          done && "opacity-55",
          dimmed && "opacity-30",
          selected && "ring-2 ring-bc-blue ring-offset-1",
        )}
        style={{
          borderLeftColor: goal?.color ?? "var(--color-border-strong)",
          background: shades?.light ?? "var(--color-surface-alt)",
          color: shades?.dark ?? "var(--color-fg)",
        }}
      >
        {done && <Icon icon="complete" size={13} strokeWidth={3} className="mt-[3px] shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[13px] font-semibold leading-tight", done && "line-through")}>
            {task.title}
            {task.isTopThree && <span className="ml-1 text-[10px] font-bold tracking-wide opacity-70">TOP 3</span>}
          </span>
          {height >= 36 && <span className="block truncate text-[11px] leading-tight opacity-75">{range}</span>}
        </span>
        {dragEnabled && (
          <span
            ref={setResizeRef}
            {...resizeAttributes}
            {...resizeListeners}
            role="button"
            aria-label={`Resize ${task.title}. Space to start, arrow keys, Space to drop.`}
            aria-roledescription="resize handle"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();
              resizeListeners?.onKeyDown?.(event);
            }}
            className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize items-center justify-center outline-none focus-visible:bg-bc-blue/20"
          >
            {/* Grip shows on hover or keyboard focus so it doesn't cover short blocks' text. */}
            <span className="h-[3px] w-6 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-40 group-focus-within:opacity-40" />
          </span>
        )}
      </div>
    </li>
  );
}

/** Minutes a block covers, for drag math in the page. */
export function taskEnd(task: TimedTask): number {
  return blockEnd(task);
}
