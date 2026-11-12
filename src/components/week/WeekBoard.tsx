"use client";

import {
  closestCorners,
  DndContext,
  pointerWithin,
  type CollisionDetection,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, type KeyboardEvent } from "react";
import type { LocalDate } from "@/lib/domain/dates";
import type { DayTask, GoalNode } from "@/lib/domain/goal-tree";
import { dayHeader } from "@/lib/domain/week";
import { dayStats, findWeekTask, planWeekMove, type WeekData, type WeekDay, type WeekMove } from "@/lib/domain/week-board";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";
import { WeekTaskCardBody } from "./WeekTaskCard";

const COLUMN_PREFIX = "day:";

/**
 * What's under the pointer wins: a task card if there is one (to drop next
 * to it), otherwise the column (append). closestCorners alone favours small
 * nearby cards over a tall column, so drops on empty column space missed.
 * Falls back to closestCorners for keyboard moves, where there's no pointer.
 */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length > 0) {
    const task = hits.find((hit) => !String(hit.id).startsWith(COLUMN_PREFIX));
    return task === undefined ? hits : [task];
  }
  return closestCorners(args);
};

type BoardProps = {
  week: WeekData;
  today: LocalDate;
  onMove: (move: WeekMove) => void;
  onMoveError: (message: string) => void;
  onOpenTask: (task: DayTask) => void;
  onAddTask: (date: LocalDate) => void;
};

/**
 * Desktop week (768px up): 7 columns, Monday to Sunday. Drag a task within a
 * column to reorder or onto another column to move it; the drop becomes one
 * scheduleTask call with the new date and a rankBetween rank. Keyboard: focus
 * a task, Space to pick up, arrow keys, Space to drop; Enter opens the task.
 */
export default function WeekBoard({ week, today, onMove, onMoveError, onOpenTask, onAddTask }: BoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter is left for opening the task sheet.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
  const goalById = new Map(week.goalTree.map((g) => [g.id, g]));
  const active = activeId === null ? null : findWeekTask(week, activeId);

  const onDragStart = ({ active: a }: DragStartEvent) => setActiveId(String(a.id));
  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    setActiveId(null);
    if (over === null) return;
    const overId = String(over.id);
    const taskId = String(a.id);
    const toDate = overId.startsWith(COLUMN_PREFIX) ? overId.slice(COLUMN_PREFIX.length) : findWeekTask(week, overId)?.date;
    if (toDate === undefined) return;
    try {
      const move = planWeekMove(week, taskId, toDate, overId.startsWith(COLUMN_PREFIX) ? null : overId);
      if (move !== null) onMove(move);
    } catch {
      onMoveError("Couldn't move that task. Refresh and try again.");
    }
  };

  return (
    <DndContext
      id="week-board"
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-7 gap-2">
        {week.days.map((day) => (
          <WeekColumn
            key={day.date}
            day={day}
            goals={week.goalTree}
            goalById={goalById}
            isToday={day.date === today}
            onOpenTask={onOpenTask}
            onAddTask={onAddTask}
          />
        ))}
      </div>
      <DragOverlay>
        {active === null ? null : (
          <div className="w-[140px] rotate-2 cursor-grabbing">
            <WeekTaskCardBody
              task={active.task}
              goalColor={active.task.goalId === null ? undefined : goalById.get(active.task.goalId)?.color}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function WeekColumn({
  day,
  goals,
  goalById,
  isToday,
  onOpenTask,
  onAddTask,
}: {
  day: WeekDay;
  goals: GoalNode[];
  goalById: Map<string, GoalNode>;
  isToday: boolean;
  onOpenTask: (task: DayTask) => void;
  onAddTask: (date: LocalDate) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${day.date}` });
  const header = dayHeader(day.date);
  const stats = dayStats(day, goals);
  const alignment = stats.alignment === null ? null : Math.round(stats.alignment * 100);

  return (
    <section
      aria-label={`${header.weekday} ${header.day}`}
      className={cn(
        "flex min-w-0 flex-col rounded-[16px] border border-border bg-surface/60 transition-colors",
        isToday && "border-bc-blue/40 bg-bc-blue-light/40",
        isOver && "bg-bc-blue-light/60",
      )}
    >
      <header className="flex items-baseline gap-1.5 px-2.5 pt-2.5 pb-1.5">
        <span className={cn("text-[11px] font-semibold tracking-wide", isToday ? "text-bc-blue" : "text-fg-secondary")}>
          {header.weekday}
        </span>
        <span className={cn("bc-data text-[17px]", isToday ? "text-bc-blue" : "text-fg")}>{header.day}</span>
      </header>

      <SortableContext items={day.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-1.5 px-1.5 pb-1.5">
          {day.tasks.map((task) => (
            <SortableTask
              key={task.id}
              task={task}
              goalColor={task.goalId === null ? undefined : goalById.get(task.goalId)?.color}
              onOpen={() => onOpenTask(task)}
            />
          ))}
        </ul>
      </SortableContext>

      <button
        type="button"
        onClick={() => onAddTask(day.date)}
        aria-label={`Add a task on ${header.weekday} ${header.day}`}
        className="mx-1.5 flex min-h-11 items-center justify-center gap-1 rounded-[10px] text-[13px] font-medium text-fg-tertiary hover:bg-surface hover:text-bc-blue"
      >
        <Icon icon="add" size={16} />
        Add
      </button>

      <footer className="border-t border-border px-2.5 pt-2 pb-2.5">
        <p className="bc-caption flex flex-wrap justify-between gap-x-2 text-[11px]">
          <span className="whitespace-nowrap">
            {stats.done}/{stats.total} done
          </span>
          <span className="whitespace-nowrap">{alignment === null ? "Nothing planned" : `${alignment}% aligned`}</span>
        </p>
        <div
          className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-border"
          role="meter"
          aria-label="Alignment: share of planned minutes linked to goals"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={alignment ?? 0}
        >
          <div className="h-full rounded-full bg-bc-blue transition-[width] duration-500" style={{ width: `${alignment ?? 0}%` }} />
        </div>
      </footer>
    </section>
  );
}

function SortableTask({ task, goalColor, onOpen }: { task: DayTask; goalColor: string | undefined; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    listeners?.onKeyDown?.(event);
    if (event.key === "Enter") onOpen();
  };
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={onOpen}
      aria-label={`${task.title}. Enter to open, Space to move.`}
      aria-roledescription="draggable task"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "cursor-grab touch-none list-none rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-bc-blue",
        isDragging && "opacity-40",
      )}
    >
      <WeekTaskCardBody task={task} goalColor={goalColor} />
    </li>
  );
}
