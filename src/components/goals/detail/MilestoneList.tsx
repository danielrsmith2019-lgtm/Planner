"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import type { MilestoneDetail } from "@/lib/domain/goal-detail";
import { rankBetween } from "@/lib/domain/rank";
import MilestoneRow, { type MilestoneRowProps } from "./MilestoneRow";

type RowHandlers = Omit<MilestoneRowProps, "milestone" | "expanded" | "onToggleExpanded" | "onOpenActions" | "addingTask">;

export type MilestoneListProps = RowHandlers & {
  milestones: MilestoneDetail[];
  /** id of the milestone whose task is being added, for its pending state. */
  addingTaskTo: string | null;
  onOpenActions: (milestone: MilestoneDetail) => void;
  /** A drop finished: the moved milestone and its new rank between its new neighbours. */
  onReorder: (milestoneId: string, rank: string) => void;
  onReorderError: (message: string) => void;
};

/**
 * Milestones in rank order, sortable with dnd-kit (drag the handle, or focus
 * it and use Space plus the arrow keys). A drop writes one row: the moved
 * milestone gets rankBetween(previous.rank, next.rank).
 */
export default function MilestoneList({
  milestones,
  addingTaskTo,
  onOpenActions,
  onReorder,
  onReorderError,
  ...handlers
}: MilestoneListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over === null || active.id === over.id) return;
    const from = milestones.findIndex((m) => m.id === active.id);
    const to = milestones.findIndex((m) => m.id === over.id);
    if (from < 0 || to < 0) return;
    const moved = arrayMove(milestones, from, to);
    const previous = moved[to - 1]?.rank ?? null;
    const next = moved[to + 1]?.rank ?? null;
    try {
      onReorder(String(active.id), rankBetween(previous, next));
    } catch {
      onReorderError("Couldn't move that milestone. Refresh and try again.");
    }
  };

  return (
    <DndContext
      id="milestones"
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={milestones.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-3">
          {milestones.map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              expanded={expanded.has(milestone.id)}
              onToggleExpanded={() => toggle(milestone.id)}
              onOpenActions={() => onOpenActions(milestone)}
              addingTask={addingTaskTo === milestone.id}
              {...handlers}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
