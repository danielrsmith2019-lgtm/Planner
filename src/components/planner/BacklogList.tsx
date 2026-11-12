"use client";

import type { DayTask, GoalNode } from "@/lib/domain/goal-tree";
import TaskRow from "./TaskRow";

/** Unscheduled tasks. Desktop: the 240px column beside the timeline. */
export default function BacklogList({
  tasks,
  goals,
  onToggle,
  dragEnabled = false,
  selectedId = null,
  onSchedule,
}: {
  tasks: DayTask[];
  goals: GoalNode[];
  onToggle: (task: DayTask) => void;
  dragEnabled?: boolean;
  selectedId?: string | null;
  /** Phones: tap or swipe left opens the schedule sheet. */
  onSchedule?: (task: DayTask) => void;
}) {
  const goalById = new Map(goals.map((g) => [g.id, g]));
  if (tasks.length === 0) return <p className="bc-label px-4 py-3">No unscheduled tasks.</p>;
  return (
    <ul className="divide-y divide-border">
      {tasks.map((task) => {
        const goal = task.goalId === null ? undefined : goalById.get(task.goalId);
        return (
          <TaskRow
            key={task.id}
            task={task}
            goalColor={goal?.color}
            goalTitle={goal?.title}
            onToggle={onToggle}
            dragEnabled={dragEnabled}
            selected={selectedId === task.id}
            onOpen={onSchedule}
            onSchedule={onSchedule}
          />
        );
      })}
    </ul>
  );
}
