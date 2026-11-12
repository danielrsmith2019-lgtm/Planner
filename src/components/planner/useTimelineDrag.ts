"use client";

import {
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { LocalDate } from "@/lib/domain/dates";
import { samePlacement, type Placement } from "@/lib/domain/day-schedule";
import type { DayTask } from "@/lib/domain/goal-tree";
import { snapDuration, snapStartMin, SNAP_MIN } from "@/lib/domain/timeline";
import { PX_PER_MIN, TIMELINE_DROPPABLE, type DragData, type DropPreview, type TimelineGeometry } from "./DailyTimeline";

export type DropIntent = { type: DragData["type"]; task: DayTask; placement: Placement };

/** Arrow keys move a keyboard drag by one 15-minute snap. */
const quarterHourKeys: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
  const step = SNAP_MIN * PX_PER_MIN;
  if (event.code === "ArrowDown") return { ...currentCoordinates, y: currentCoordinates.y + step };
  if (event.code === "ArrowUp") return { ...currentCoordinates, y: currentCoordinates.y - step };
  return undefined;
};

/** Pointer first (the grid is one droppable); rect overlap for keyboard drags. */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

function clientYOf(event: Event | null): number | null {
  if (event === null) return null;
  if ("clientY" in event && typeof event.clientY === "number") return event.clientY;
  if ("touches" in event) {
    const touch = (event as TouchEvent).touches[0];
    return touch === undefined ? null : touch.clientY;
  }
  return null;
}

/**
 * The drag logic for Today's DndContext. No droppable per slot: the grid is
 * one droppable and the time comes from the pointer's Y offset inside it,
 * snapped with Math.round((y / pxPerMin) / 15) * 15 and clamped to the
 * visible hours (snapStartMin / snapDuration).
 *
 * - backlog-task: the pointer's position is the new start.
 * - timeline-block: the block's new top (pointer minus where it was grabbed).
 * - resize-handle: the pointer's position is the new end.
 * Keyboard drags (no pointer) use the dragged element's moved rect instead.
 */
export function useTimelineDrag({
  date,
  geometryRef,
  onDrop,
}: {
  date: LocalDate;
  geometryRef: MutableRefObject<TimelineGeometry | null>;
  onDrop: (intent: DropIntent) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: quarterHourKeys,
      // Enter stays "toggle done" on blocks.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );
  const [active, setActive] = useState<DragData | null>(null);
  const [preview, setPreview] = useState<DropPreview | null>(null);
  const pointerY = useRef<number | null>(null);
  const grabOffset = useRef(0);

  // Track the real pointer while dragging (dnd-kit's delta is scroll-adjusted).
  useEffect(() => {
    if (active === null) return;
    const onMove = (event: PointerEvent) => {
      pointerY.current = event.clientY;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [active]);

  const intentFor = (event: DragMoveEvent | DragEndEvent): DropIntent | null => {
    const data = event.active.data.current as DragData | undefined;
    const geo = geometryRef.current;
    if (data === undefined || geo === null || geo.grid === null || event.over?.id !== TIMELINE_DROPPABLE) return null;
    const gridTop = geo.grid.getBoundingClientRect().top;
    const moved = event.active.rect.current.translated;
    const { task } = data;
    const { startHour, endHour } = geo;

    if (data.type === "resize-handle") {
      if (task.startMin === null) return null;
      const endY = pointerY.current ?? (moved === null ? null : moved.top + moved.height);
      if (endY === null) return null;
      const durationMin = snapDuration(task.startMin, endY - gridTop, PX_PER_MIN, startHour, endHour);
      return { type: data.type, task, placement: { scheduledDate: date, startMin: task.startMin, durationMin } };
    }

    const durationMin = task.durationMin ?? 30;
    const topY =
      data.type === "timeline-block"
        ? pointerY.current === null
          ? (moved?.top ?? null)
          : pointerY.current - grabOffset.current
        : (pointerY.current ?? moved?.top ?? null);
    if (topY === null) return null;
    const startMin = snapStartMin(topY - gridTop, PX_PER_MIN, startHour, endHour, durationMin);
    return { type: data.type, task, placement: { scheduledDate: date, startMin, durationMin } };
  };

  const toPreview = (intent: DropIntent | null): DropPreview | null =>
    intent === null || intent.placement.startMin === null
      ? null
      : { startMin: intent.placement.startMin, durationMin: intent.placement.durationMin ?? 30 };

  return {
    sensors,
    collisionDetection,
    active,
    preview,
    onDragStart: (event: DragStartEvent) => {
      const data = event.active.data.current as DragData | undefined;
      const startY = clientYOf(event.activatorEvent);
      pointerY.current = startY;
      const initialTop = event.active.rect.current.initial?.top;
      grabOffset.current = startY !== null && initialTop !== undefined ? startY - initialTop : 0;
      setActive(data ?? null);
    },
    onDragMove: (event: DragMoveEvent) => setPreview(toPreview(intentFor(event))),
    onDragEnd: (event: DragEndEvent) => {
      const intent = intentFor(event);
      setActive(null);
      setPreview(null);
      pointerY.current = null;
      if (intent !== null && !samePlacement(intent.task, intent.placement)) onDrop(intent);
    },
    onDragCancel: () => {
      setActive(null);
      setPreview(null);
      pointerY.current = null;
    },
  };
}
